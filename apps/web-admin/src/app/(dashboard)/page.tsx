'use client';

import {
  ApiError,
  useAdminEvents,
  useCreateEvent,
  usePublishEvent,
  useVenues,
  type AdminEventRow,
  type OrganizationSummary,
} from '@nexaticket/ts-sdk';
import {
  Badge,
  Button,
  EVENT_CATEGORIES,
  EmptyState,
  ErrorState,
  FilterBar,
  Input,
  Modal,
  PageHeader,
  RowActions,
  Select,
  StatCard,
  StatGrid,
  Table,
  eventCategoryLabel,
  formatDateTime,
  formatNumber,
  foldText,
  matchesText,
  useToast,
} from '@nexaticket/ui';
import { CalendarPlus, Eye, EyeOff, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { OrganizationGate } from '@/components/OrganizationGate';

/**
 * A-EVENTS — bảng sự kiện của tổ chức, gồm cả bản nháp.
 *
 * Publish gọi thẳng từ dòng cho nhanh. Điều kiện đủ để publish (`blockers`) chỉ có ở đường đọc
 * chi tiết, nên ở đây ta cứ gửi và để backend từ chối — thông báo lỗi của nó nói rõ còn thiếu gì,
 * chính xác hơn bất cứ suy đoán nào ở client.
 */
export default function EventsPage() {
  return (
    <OrganizationGate title="Sự kiện">
      {(organization) => <EventsContent organization={organization} />}
    </OrganizationGate>
  );
}

const STATUS_FILTERS = [
  { value: '', label: 'Mọi trạng thái' },
  { value: 'PUBLISHED', label: 'Đang bán' },
  { value: 'DRAFT', label: 'Nháp' },
];

const CATEGORY_FILTERS = [
  { value: '', label: 'Mọi thể loại' },
  ...EVENT_CATEGORIES.map((category) => ({ value: category.value, label: category.label })),
];

type SortKey = 'title' | 'next' | 'sessions' | 'capacity';

/**
 * Nội dung tách riêng vì hook không gọi có điều kiện được: cổng phía trên quyết định có dựng hay
 * không, còn ở đây tổ chức đã chắc chắn tồn tại nên mọi hook chạy vô điều kiện.
 */
function EventsContent({ organization }: { organization: OrganizationSummary }) {
  const toast = useToast();
  const organizationId = organization.id;

  const router = useRouter();
  const events = useAdminEvents(organizationId);
  const venues = useVenues(organizationId);
  const createEvent = useCreateEvent(organizationId);
  const publish = usePublishEvent(organizationId);

  const [formOpen, setFormOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('next');
  const [descending, setDescending] = useState(false);

  const data = events.data;

  const stats = useMemo(() => {
    const rows = data ?? [];
    return {
      total: rows.length,
      published: rows.filter((row) => row.status === 'PUBLISHED').length,
      draft: rows.filter((row) => row.status !== 'PUBLISHED').length,
      // Nháp không có suất diễn thì không bao giờ bán được — đó là nhóm cần nhìn thấy, không phải
      // một con số thống kê cho vui.
      noSession: rows.filter((row) => row.sessionCount === 0).length,
    };
  }, [data]);

  const visible = useMemo(() => {
    const needle = foldText(query.trim());
    const filtered = (data ?? []).filter((row) => {
      if (status && row.status !== status) return false;
      if (category && row.category !== category) return false;
      return matchesText(needle, [row.title, row.slug, row.venueName]);
    });
    return filtered.sort((a, b) => (descending ? -compare(a, b, sortKey) : compare(a, b, sortKey)));
  }, [data, query, status, category, sortKey, descending]);

  const filtering = Boolean(query.trim() || status || category);
  const loading = events.isPending;
  const fail = (error: unknown) => toast.showError(error instanceof ApiError ? error : null);

  const submit = (formData: FormData) => {
    createEvent.mutate(
      {
        venueId: String(formData.get('venueId') ?? ''),
        title: String(formData.get('title') ?? '').trim(),
        category: String(formData.get('category') ?? 'khac'),
        summary: String(formData.get('summary') ?? '').trim() || undefined,
      },
      {
        // Sự kiện vừa tạo chưa bán được gì: chưa có suất diễn, chưa có giá. Đưa thẳng sang trang
        // chi tiết thay vì thả người dùng lại bảng danh sách với một dòng nháp và không manh mối
        // nào về bước tiếp theo.
        onSuccess: (event) => {
          setFormOpen(false);
          router.push(`/events/${event.id}?org=${organizationId}`);
        },
        onError: fail,
      },
    );
  };

  const hasVenue = (venues.data ?? []).length > 0;
  const noEventsAtAll = !loading && (data ?? []).length === 0;

  return (
    <>
      <PageHeader
        title="Sự kiện"
        description={`Sự kiện của ${organization.name}, gồm cả bản nháp chưa xuất bản.`}
        actions={
          <Button onClick={() => setFormOpen(true)} disabled={!hasVenue}>
            <CalendarPlus size={18} aria-hidden="true" />
            Tạo sự kiện
          </Button>
        }
      />

      {events.isError ? (
        <ErrorState
          error={events.error instanceof ApiError ? events.error : null}
          correlationId={events.error instanceof ApiError ? events.error.correlationId : null}
          onRetry={() => void events.refetch()}
        />
      ) : noEventsAtAll && !hasVenue ? (
        // Không thể tạo sự kiện khi chưa có địa điểm — nói thẳng bước tiếp theo thay vì để nút
        // "Tạo sự kiện" mờ đi không rõ lý do.
        <EmptyState
          title="Cần một địa điểm trước"
          description="Sự kiện phải gắn với một địa điểm. Tạo địa điểm rồi quay lại đây."
          action={
            <Link href="/venues">
              <Button>Tới trang Địa điểm</Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="mb-5">
            <StatGrid>
              <StatCard label="Sự kiện" value={loading ? null : stats.total} />
              <StatCard label="Đang bán" value={loading ? null : stats.published} />
              <StatCard label="Nháp" value={loading ? null : stats.draft} />
              <StatCard
                label="Chưa có suất"
                value={loading ? null : stats.noSession}
                tone={stats.noSession > 0 ? 'warn' : 'default'}
                hint="Không bán được cho tới khi thêm suất"
              />
            </StatGrid>
          </div>

          <FilterBar
            actions={
              <Button
                variant="secondary"
                disabled={!filtering}
                onClick={() => {
                  setQuery('');
                  setStatus('');
                  setCategory('');
                }}
              >
                Xoá bộ lọc
              </Button>
            }
            count={
              loading
                ? 'Đang tải…'
                : filtering
                  ? `Hiện ${formatNumber(visible.length)} trong ${formatNumber((data ?? []).length)} sự kiện.`
                  : `${formatNumber((data ?? []).length)} sự kiện.`
            }
          >
            <Input
              label="Tìm sự kiện"
              type="search"
              value={query}
              placeholder="Tên sự kiện, đường dẫn hoặc địa điểm"
              hint="Gõ không dấu vẫn khớp tên có dấu."
              onChange={(event) => setQuery(event.target.value)}
            />
            <Select
              label="Trạng thái"
              value={status}
              options={STATUS_FILTERS}
              onChange={(event) => setStatus(event.target.value)}
            />
            <Select
              label="Thể loại"
              value={category}
              options={CATEGORY_FILTERS}
              onChange={(event) => setCategory(event.target.value)}
            />
          </FilterBar>

          <div className="mt-5">
            <Table<AdminEventRow>
              caption="Danh sách sự kiện"
              loading={loading}
              rows={visible}
              rowKey={(row) => row.id}
              sort={{ key: sortKey, descending }}
              onSortChange={(key) => {
                if (key === sortKey) {
                  setDescending(!descending);
                  return;
                }
                setSortKey(key as SortKey);
                setDescending(false);
              }}
              emptyTitle={filtering ? 'Không sự kiện nào khớp bộ lọc' : 'Chưa có sự kiện nào'}
              emptyDescription={filtering ? undefined : 'Tạo sự kiện đầu tiên của tổ chức.'}
              columns={[
                {
                  key: 'title',
                  header: 'Sự kiện',
                  sortable: true,
                  // Đường vào trang suất diễn & giá vé. Danh sách này không đặt giá được, và trước
                  // khi có link ở đây thì không có đường nào tới chỗ đặt giá cả.
                  cell: (row) => (
                    <div className="grid gap-0.5">
                      <Link
                        href={`/events/${row.id}?org=${organizationId}`}
                        className="font-medium"
                      >
                        {row.title}
                      </Link>
                      <span className="text-[13px] text-muted">
                        {eventCategoryLabel(row.category)}
                      </span>
                    </div>
                  ),
                },
                {
                  key: 'status',
                  header: 'Trạng thái',
                  cell: (row) => (
                    <Badge tone={row.status === 'PUBLISHED' ? 'success' : 'neutral'}>
                      {row.status === 'PUBLISHED' ? 'Đang bán' : 'Nháp'}
                    </Badge>
                  ),
                },
                { key: 'venue', header: 'Địa điểm', cell: (row) => row.venueName ?? '—' },
                {
                  key: 'next',
                  header: 'Suất gần nhất',
                  sortable: true,
                  cell: (row) => (row.nextSessionAt ? formatDateTime(row.nextSessionAt) : '—'),
                },
                {
                  key: 'sessions',
                  header: 'Suất',
                  numeric: true,
                  sortable: true,
                  cell: (row) =>
                    row.sessionCount === 0 ? (
                      <Badge tone="warn">Chưa có</Badge>
                    ) : (
                      formatNumber(row.sessionCount)
                    ),
                },
                {
                  key: 'capacity',
                  header: 'Sức chứa',
                  numeric: true,
                  sortable: true,
                  cell: (row) => formatNumber(row.capacity),
                },
                {
                  key: 'action',
                  header: '',
                  cell: (row) => (
                    <RowActions>
                      <Link href={`/events/${row.id}?org=${organizationId}`}>
                        <Button variant="secondary">
                          <Settings2 size={16} aria-hidden="true" />
                          Suất & giá vé
                        </Button>
                      </Link>
                      <Button
                        variant="secondary"
                        loading={publish.isPending && publish.variables?.eventId === row.id}
                        disabled={publish.isPending}
                        onClick={() =>
                          publish.mutate(
                            { eventId: row.id, publish: row.status !== 'PUBLISHED' },
                            { onError: fail },
                          )
                        }
                      >
                        {row.status === 'PUBLISHED' ? (
                          <EyeOff size={16} aria-hidden="true" />
                        ) : (
                          <Eye size={16} aria-hidden="true" />
                        )}
                        {row.status === 'PUBLISHED' ? 'Gỡ bán' : 'Xuất bản'}
                      </Button>
                    </RowActions>
                  ),
                },
              ]}
            />
          </div>
        </>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Tạo sự kiện"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Huỷ
            </Button>
            <Button type="submit" form="create-event" loading={createEvent.isPending}>
              Tạo nháp
            </Button>
          </>
        }
      >
        <form id="create-event" action={submit} className="grid gap-4">
          <Input name="title" label="Tên sự kiện" required maxLength={200} />
          <Select
            name="venueId"
            label="Địa điểm"
            required
            options={(venues.data ?? []).map((venue) => ({
              value: venue.id,
              label: `${venue.name} · ${venue.city}`,
            }))}
          />
          <Select name="category" label="Thể loại" required options={EVENT_CATEGORIES} />
          <Input
            name="summary"
            label="Mô tả ngắn"
            maxLength={500}
            hint="Hiện trên thẻ sự kiện ở trang khách."
          />
        </form>
      </Modal>
    </>
  );
}

/**
 * Sự kiện chưa có suất xếp cuối khi sắp theo "suất gần nhất".
 *
 * `null` mà quy về 0 thì chúng nhảy lên đầu bảng như thể sắp diễn ra tới nơi — đúng ngược với sự
 * thật là chúng chưa bán được vé nào.
 */
function compare(a: AdminEventRow, b: AdminEventRow, sort: SortKey): number {
  const byTitle = a.title.localeCompare(b.title, 'vi');
  switch (sort) {
    case 'next': {
      const left = a.nextSessionAt ? Date.parse(a.nextSessionAt) : Number.POSITIVE_INFINITY;
      const right = b.nextSessionAt ? Date.parse(b.nextSessionAt) : Number.POSITIVE_INFINITY;
      return left - right || byTitle;
    }
    case 'sessions':
      return a.sessionCount - b.sessionCount || byTitle;
    case 'capacity':
      return a.capacity - b.capacity || byTitle;
    default:
      return byTitle;
  }
}
