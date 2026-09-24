'use client';

import {
  ApiError,
  useCreateOrganization,
  useHasPermission,
  useOrganizationLifecycle,
  usePlatformOrganizations,
  type CreatedOrganization,
  type OrganizationStatus,
  type OrganizationSummary,
} from '@nexaticket/ts-sdk';
import {
  Badge,
  Button,
  CopyField,
  ErrorState,
  FilterBar,
  Input,
  Modal,
  PageHeader,
  Pagination,
  RowActions,
  Select,
  StatCard,
  StatGrid,
  Table,
  formatDate,
  formatNumber,
  foldText,
  matchesText,
  useToast,
} from '@nexaticket/ui';
import { Lock, LockOpen, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';

/**
 * P-ORGS — danh sách tổ chức toàn nền tảng, bộ lọc, và các thao tác vòng đời.
 *
 * Chỉ superadmin gọi được `/v1/platform/organizations`; backend tự kiểm, frontend không đoán vai
 * trò. ADR-1010: không có luồng tự đăng ký tổ chức — tạo ở đây là đường duy nhất.
 *
 * <h3>Bộ lọc sống trên URL</h3>
 *
 * plan/frontend.md §10 đòi vậy cho cả app này, và lý do rất thực dụng: một dòng "tổ chức X đang bị
 * khoá" trong ticket vận hành cần dán được **đường dẫn tới đúng cái nhìn đó**, không phải bảy bước
 * hướng dẫn bấm lại bộ lọc.
 *
 * <h3>Lọc ở phía trình duyệt, và vì sao</h3>
 *
 * `GET /v1/platform/organizations` chỉ có `limit`/`offset` — không có `q`, không có `status`. Nên
 * màn này tải một **cửa sổ 200 dòng** (trần cứng của backend) rồi lọc, sắp xếp tại chỗ. Khi vượt
 * 200 tổ chức, nút chuyển cửa sổ ở cuối bảng là đường đi tiếp — và đó cũng là lúc nên thêm tham số
 * lọc vào backend thay vì kéo cả bảng về máy người dùng.
 */
export default function OrganizationsPage() {
  return (
    // `useSearchParams` buộc phải nằm trong một biên Suspense, nếu không `next build` dừng ở bước
    // prerender với đúng câu nhắc đó. Không truyền fallback: `loading.tsx` của nhóm route đã lo
    // khung chờ, và hai lớp khung chờ chồng nhau chỉ làm màn hình nhấp nháy thêm một nhịp.
    <Suspense>
      <OrganizationsScreen />
    </Suspense>
  );
}

/** Trần cứng của `limit` ở backend (`OrganizationQueries.MAX_PAGE_SIZE`). */
const WINDOW_SIZE = 200;

const STATUS_VALUES = ['ACTIVE', 'SUSPENDED'] as const;

const STATUS_FILTERS = [
  { value: '', label: 'Mọi trạng thái' },
  { value: 'ACTIVE', label: 'Đang hoạt động' },
  { value: 'SUSPENDED', label: 'Đang khoá' },
];

const SIZE_VALUES = ['none', 'small', 'large'] as const;

/**
 * Lọc theo quy mô thành viên.
 *
 * "Chưa có thành viên" là nhóm đáng có tên riêng: đó là những tổ chức đã tạo nhưng chủ sở hữu chưa
 * bao giờ nhận lời mời — một tổ chức chết mà không có gì trên bảng nói ra điều đó.
 */
const SIZE_FILTERS = [
  { value: '', label: 'Mọi quy mô' },
  { value: 'none', label: 'Chưa có thành viên' },
  { value: 'small', label: '1–5 thành viên' },
  { value: 'large', label: 'Trên 5 thành viên' },
];

const SORT_VALUES = ['name', 'members', 'status'] as const;

type SizeFilter = '' | (typeof SIZE_VALUES)[number];
type SortKey = (typeof SORT_VALUES)[number];

function OrganizationsScreen() {
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();

  const canManage = useHasPermission('PLATFORM_ORG_MANAGE', null);

  const status = pick<OrganizationStatus>(params.get('status'), STATUS_VALUES);
  const size = pick<SizeFilter>(params.get('size'), SIZE_VALUES);
  const sortKey: SortKey = pick<SortKey>(params.get('sort'), SORT_VALUES) || 'name';
  const descending = params.get('desc') === '1';
  const windowIndex = Math.max(0, Math.trunc(Number(params.get('win')) || 0));

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === '') next.delete(key);
        else next.set(key, value);
      }
      const query = next.toString();
      router.replace(query ? `/organizations?${query}` : '/organizations', { scroll: false });
    },
    [params, router],
  );

  // Ô tìm kiếm đọc URL đúng một lần rồi sống trong state. Ghi lại URL mỗi ký tự là một lần điều
  // hướng mềm cho từng phím bấm; còn đọc từ URL mỗi lần render thì con trỏ chạy sau ngón tay. Chốt
  // sau 300ms không gõ là đường ở giữa: gõ mượt, mà đường dẫn vẫn dán được cho người khác.
  const [query, setQuery] = useState(() => params.get('q') ?? '');

  useEffect(() => {
    const applied = params.get('q') ?? '';
    const typed = query.trim();
    if (applied === typed) return;
    const timer = setTimeout(() => setParams({ q: typed, win: null }), 300);
    return () => clearTimeout(timer);
  }, [query, params, setParams]);

  const organizations = usePlatformOrganizations({
    limit: WINDOW_SIZE,
    offset: windowIndex * WINDOW_SIZE,
  });
  const createOrganization = useCreateOrganization();
  const lifecycle = useOrganizationLifecycle();

  const [formOpen, setFormOpen] = useState(false);
  const [created, setCreated] = useState<CreatedOrganization | null>(null);
  const [confirming, setConfirming] = useState<OrganizationSummary | null>(null);

  // Phụ thuộc của `useMemo` là `organizations.data`, không phải một biểu thức `?? []`: mảng rỗng
  // mới sinh ra ở mỗi lần render là một danh tính mới, và memo nào nhận nó cũng chạy lại mỗi render.
  const data = organizations.data;
  const loadedCount = data?.length ?? 0;

  const stats = useMemo(() => {
    const rows = data ?? [];
    return {
      total: rows.length,
      active: rows.filter((row) => row.status === 'ACTIVE').length,
      suspended: rows.filter((row) => row.status === 'SUSPENDED').length,
      members: rows.reduce((sum, row) => sum + row.memberCount, 0),
      empty: rows.filter((row) => row.memberCount === 0).length,
    };
  }, [data]);

  const visible = useMemo(() => {
    const needle = foldText(query.trim());

    const filtered = (data ?? []).filter((row) => {
      if (status && row.status !== status) return false;
      if (!matchesSize(row.memberCount, size)) return false;
      // Cả id: khi một lỗi đến từ log hay từ ticket, thứ người ta có trong tay là UUID.
      return matchesText(needle, [row.name, row.slug, row.id]);
    });

    return filtered.sort((a, b) => (descending ? -compare(a, b, sortKey) : compare(a, b, sortKey)));
  }, [data, query, status, size, sortKey, descending]);

  const filtering = Boolean(query.trim() || status || size);
  const loading = organizations.isPending;
  const fail = (error: unknown) => toast.showError(error instanceof ApiError ? error : null);

  const resetFilters = () => {
    setQuery('');
    setParams({ q: null, status: null, size: null });
  };

  const submitCreate = (formData: FormData) => {
    const name = String(formData.get('name') ?? '').trim();
    const ownerEmail = String(formData.get('ownerEmail') ?? '').trim();
    const slug = String(formData.get('slug') ?? '').trim();

    createOrganization.mutate(
      { name, ownerEmail, ...(slug ? { slug } : {}) },
      {
        onSuccess: (organization) => {
          setFormOpen(false);
          // Token lời mời chỉ trả về ĐÚNG MỘT LẦN. Đóng hộp thoại mà không hiện nó ra là mất
          // luôn — chủ sở hữu mới sẽ không vào được tổ chức vừa tạo.
          setCreated(organization);
        },
        onError: fail,
      },
    );
  };

  const runLifecycle = () => {
    if (!confirming) return;
    const suspending = confirming.status === 'ACTIVE';
    lifecycle.mutate(
      { organizationId: confirming.id, action: suspending ? 'suspend' : 'activate' },
      {
        onSuccess: () => {
          setConfirming(null);
          toast.show({
            tone: 'success',
            message: suspending ? 'Đã khoá tổ chức' : 'Đã mở khoá tổ chức',
          });
        },
        onError: fail,
      },
    );
  };

  return (
    <>
      <PageHeader
        title="Tổ chức"
        description="Mọi tổ chức trên nền tảng. Tạo tổ chức là đường duy nhất để một đơn vị bắt đầu bán vé."
        actions={
          canManage ? (
            <Button onClick={() => setFormOpen(true)}>
              <Plus size={18} aria-hidden="true" />
              Tạo tổ chức
            </Button>
          ) : undefined
        }
      />

      <div className="mb-5">
        <StatGrid>
          <StatCard
            label="Tổ chức"
            value={loading ? null : stats.total}
            hint={windowIndex > 0 ? `Trang ${windowIndex + 1}` : undefined}
          />
          <StatCard label="Đang hoạt động" value={loading ? null : stats.active} />
          <StatCard
            label="Đang khoá"
            value={loading ? null : stats.suspended}
            tone={stats.suspended > 0 ? 'warn' : 'default'}
          />
          <StatCard
            label="Chưa có thành viên"
            value={loading ? null : stats.empty}
            tone={stats.empty > 0 ? 'warn' : 'default'}
            hint="Chủ sở hữu chưa nhận lời mời"
          />
          <StatCard label="Tổng thành viên" value={loading ? null : stats.members} />
        </StatGrid>
      </div>

      <FilterBar
        actions={
          <Button variant="secondary" onClick={resetFilters} disabled={!filtering}>
            Xoá bộ lọc
          </Button>
        }
        count={
          loading
            ? 'Đang tải…'
            : filtering
              ? `Hiện ${formatNumber(visible.length)} trong ${formatNumber(loadedCount)} tổ chức đã tải.`
              : `${formatNumber(loadedCount)} tổ chức đã tải.`
        }
      >
        <Input
          label="Tìm tổ chức"
          type="search"
          value={query}
          placeholder="Tên, đường dẫn hoặc mã tổ chức"
          hint="Gõ không dấu vẫn khớp tên có dấu."
          onChange={(event) => setQuery(event.target.value)}
        />
        <Select
          label="Trạng thái"
          value={status}
          options={STATUS_FILTERS}
          onChange={(event) => setParams({ status: event.target.value, win: null })}
        />
        <Select
          label="Quy mô"
          value={size}
          options={SIZE_FILTERS}
          onChange={(event) => setParams({ size: event.target.value, win: null })}
        />
      </FilterBar>

      {organizations.isError ? (
        <div className="mt-5">
          <ErrorState
            error={organizations.error instanceof ApiError ? organizations.error : null}
            correlationId={
              organizations.error instanceof ApiError ? organizations.error.correlationId : null
            }
            onRetry={() => void organizations.refetch()}
          />
        </div>
      ) : (
        <>
          <div className="mt-5">
            <Table<OrganizationSummary>
              caption="Danh sách tổ chức"
              loading={loading}
              rows={visible}
              rowKey={(row) => row.id}
              onRowClick={(row) => router.push(`/organizations/${row.id}`)}
              sort={{ key: sortKey, descending }}
              // Bấm lại cột đang sắp thì đảo chiều; bấm cột khác thì về chiều xuôi của cột đó.
              onSortChange={(key) =>
                setParams({ sort: key, desc: sortKey === key && !descending ? '1' : null })
              }
              emptyTitle={filtering ? 'Không tổ chức nào khớp bộ lọc' : 'Chưa có tổ chức nào'}
              emptyDescription={
                filtering ? (
                  <Button variant="ghost" onClick={resetFilters}>
                    Xoá bộ lọc
                  </Button>
                ) : (
                  'Tạo tổ chức đầu tiên để bắt đầu.'
                )
              }
              columns={[
                {
                  key: 'name',
                  header: 'Tên',
                  sortable: true,
                  cell: (row) => (
                    <div className="grid gap-0.5">
                      <span className="font-medium">{row.name}</span>
                      <span className="font-mono text-[13px] text-muted">{row.slug}</span>
                    </div>
                  ),
                },
                {
                  key: 'status',
                  header: 'Trạng thái',
                  sortable: true,
                  cell: (row) => (
                    <Badge tone={row.status === 'ACTIVE' ? 'success' : 'warn'}>
                      {row.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đang khoá'}
                    </Badge>
                  ),
                },
                {
                  key: 'members',
                  header: 'Thành viên',
                  numeric: true,
                  sortable: true,
                  cell: (row) =>
                    row.memberCount === 0 ? (
                      // 0 không phải một con số bình thường ở cột này: chủ sở hữu chưa nhận lời
                      // mời, và tổ chức chưa ai vào được.
                      <Badge tone="warn">Chưa có</Badge>
                    ) : (
                      formatNumber(row.memberCount)
                    ),
                },
                {
                  key: 'actions',
                  header: '',
                  cell: (row) => (
                    // Chặn nổi bọt: cả dòng dẫn sang màn chi tiết, và nút "Khoá" nằm trong dòng
                    // đó — không chặn thì một lần bấm chạy cả hai việc.
                    <div onClick={(event) => event.stopPropagation()}>
                      <RowActions>
                        <Link href={`/organizations/${row.id}`}>
                          <Button variant="ghost">Chi tiết</Button>
                        </Link>
                        {canManage ? (
                          <Button
                            variant={row.status === 'ACTIVE' ? 'danger-soft' : 'secondary'}
                            onClick={() => setConfirming(row)}
                          >
                            {row.status === 'ACTIVE' ? (
                              <Lock size={16} aria-hidden="true" />
                            ) : (
                              <LockOpen size={16} aria-hidden="true" />
                            )}
                            {row.status === 'ACTIVE' ? 'Khoá' : 'Mở khoá'}
                          </Button>
                        ) : null}
                      </RowActions>
                    </div>
                  ),
                },
              ]}
            />
          </div>

          {windowIndex > 0 || loadedCount === WINDOW_SIZE ? (
            <Pagination
              page={windowIndex}
              received={loadedCount}
              pageSize={WINDOW_SIZE}
              onChange={(next) => setParams({ win: next === 0 ? null : String(next) })}
              label={`Mỗi trang tối đa ${WINDOW_SIZE} tổ chức — trần của API.`}
            />
          ) : null}
        </>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Tạo tổ chức"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Huỷ
            </Button>
            <Button type="submit" form="create-organization" loading={createOrganization.isPending}>
              Tạo
            </Button>
          </>
        }
      >
        <form id="create-organization" action={submitCreate} className="grid gap-4">
          <Input name="name" label="Tên tổ chức" required maxLength={200} />
          <Input
            name="ownerEmail"
            type="email"
            label="Email chủ sở hữu"
            required
            hint="Người này nhận lời mời làm ORG_OWNER."
          />
          <Input
            name="slug"
            label="Đường dẫn"
            maxLength={64}
            hint="Bỏ trống thì hệ thống tự sinh từ tên. Đã đặt rồi thì đổi sau sẽ làm chết liên kết cũ."
          />
        </form>
      </Modal>

      <Modal
        open={created !== null}
        onClose={() => setCreated(null)}
        title="Đã tạo tổ chức"
        footer={<Button onClick={() => setCreated(null)}>Xong</Button>}
      >
        <p className="mt-0">
          <strong>{created?.name}</strong> đã được tạo ngày {formatDate(new Date())}. Gửi mã lời mời
          dưới đây cho <strong>{created?.ownerEmail}</strong> để họ nhận quyền chủ sở hữu.
        </p>
        {created ? <CopyField label="Mã lời mời" value={created.invitationToken} /> : null}
        <p className="mb-0 text-[13px] text-muted">
          Mã này chỉ hiện đúng một lần. Đóng hộp thoại là không đọc lại được.
        </p>
      </Modal>

      <Modal
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={confirming?.status === 'ACTIVE' ? 'Khoá tổ chức?' : 'Mở khoá tổ chức?'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(null)}>
              Huỷ
            </Button>
            <Button
              variant={confirming?.status === 'ACTIVE' ? 'danger' : 'primary'}
              onClick={runLifecycle}
              loading={lifecycle.isPending}
            >
              {confirming?.status === 'ACTIVE' ? 'Khoá tổ chức' : 'Mở khoá'}
            </Button>
          </>
        }
      >
        {confirming?.status === 'ACTIVE' ? (
          <p className="m-0">
            <strong>{confirming?.name}</strong> sẽ không mời được thành viên mới. Khoá{' '}
            <strong>không</strong> dừng việc bán vé đang diễn ra và không xoá gì — muốn dừng bán thì
            phải rút sự kiện xuống ở phía tổ chức.
          </p>
        ) : (
          <p className="m-0">
            <strong>{confirming?.name}</strong> hoạt động lại bình thường ngay sau khi mở khoá.
          </p>
        )}
      </Modal>
    </>
  );
}

/** Giá trị lạ trên URL rơi về "không lọc" thay vì cho ra một bảng trống không giải thích được. */
function pick<T extends string>(raw: string | null, allowed: readonly string[]): T | '' {
  return raw && allowed.includes(raw) ? (raw as T) : '';
}

function matchesSize(memberCount: number, size: SizeFilter): boolean {
  switch (size) {
    case 'none':
      return memberCount === 0;
    case 'small':
      return memberCount >= 1 && memberCount <= 5;
    case 'large':
      return memberCount > 5;
    default:
      return true;
  }
}

/** Đang khoá đứng trước: đó là nhóm cần xử lý, không phải nhóm để xem cho biết. */
const STATUS_RANK: Record<OrganizationStatus, number> = { SUSPENDED: 0, ACTIVE: 1 };

function compare(a: OrganizationSummary, b: OrganizationSummary, sort: SortKey): number {
  const byName = a.name.localeCompare(b.name, 'vi');
  switch (sort) {
    case 'members':
      return a.memberCount - b.memberCount || byName;
    case 'status':
      return STATUS_RANK[a.status] - STATUS_RANK[b.status] || byName;
    default:
      return byName;
  }
}
