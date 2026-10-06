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
import {
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Eye,
  EyeOff,
  FilePen,
  LayoutTemplate,
  Radio,
  Settings2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { CreateFromTemplateDialog } from '@/components/CreateFromTemplateDialog';
import { OrganizationGate } from '@/components/OrganizationGate';
import { canTogglePublish, eventStatusLabel, eventStatusTone } from '@/lib/event-status';

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
  { value: 'UNPUBLISHED', label: 'Đã gỡ bán' },
  { value: 'CANCELLED', label: 'Đã huỷ' },
];

const CATEGORY_FILTERS = [
  { value: '', label: 'Mọi thể loại' },
  ...EVENT_CATEGORIES.map((category) => ({ value: category.value, label: category.label })),
];

/**
 * Lọc theo tình trạng suất diễn.
 *
 * `no-session` là lý do khối này tồn tại: ô số "Chưa có suất" vẫn đếm nhóm ấy từ trước, nhưng
 * không có cách nào xem chúng. Một con số cảnh báo mà không mở ra được danh sách là một con số
 * bắt người dùng tự dò cả bảng.
 */
const SESSION_FILTERS = [
  { value: '', label: 'Mọi suất diễn' },
  { value: 'upcoming', label: 'Còn suất sắp tới' },
  { value: 'past', label: 'Đã diễn ra hết' },
  { value: 'no-session', label: 'Chưa có suất' },
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
  const [templateOpen, setTemplateOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [venue, setVenue] = useState('');
  const [session, setSession] = useState('');
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
    const now = Date.now();

    const filtered = (data ?? []).filter((row) => {
      if (status && row.status !== status) return false;
      if (category && row.category !== category) return false;
      if (venue && row.venueName !== venue) return false;
      if (session && !matchesSession(row, session, now)) return false;
      return matchesText(needle, [row.title, row.slug, row.venueName]);
    });
    return filtered.sort((a, b) => (descending ? -compare(a, b, sortKey) : compare(a, b, sortKey)));
  }, [data, query, status, category, venue, session, sortKey, descending]);

  /** Địa điểm dựng từ chính dữ liệu đang có, không từ danh sách địa điểm của tổ chức: bảng này chỉ
      lọc được những gì nó đang hiển thị, và một mục chọn ra 0 dòng là một mục gây bực. */
  const venueOptions = useMemo(() => {
    const names = new Set<string>();
    for (const row of data ?? []) {
      if (row.venueName) names.add(row.venueName);
    }
    return [...names]
      .sort((a, b) => a.localeCompare(b, 'vi'))
      .map((name) => ({ value: name, label: name }));
  }, [data]);

  const filtering = Boolean(query.trim() || status || category || venue || session);
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
          <div className="flex flex-wrap gap-2">
            {/* Dựng từ khung không cần địa điểm có sẵn — khung tự tạo địa điểm mới. */}
            <Button variant="secondary" onClick={() => setTemplateOpen(true)}>
              <LayoutTemplate size={18} aria-hidden="true" />
              Từ khung mẫu
            </Button>
            <Button onClick={() => setFormOpen(true)} disabled={!hasVenue}>
              <CalendarPlus size={18} aria-hidden="true" />
              Tạo sự kiện
            </Button>
          </div>
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
          description="Sự kiện phải gắn với một địa điểm. Tạo địa điểm rồi quay lại đây, hoặc dựng nhanh từ khung mẫu của nền tảng — khung tự tạo địa điểm."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/venues">
                <Button>Tới trang Địa điểm</Button>
              </Link>
              <Button variant="secondary" onClick={() => setTemplateOpen(true)}>
                Từ khung mẫu
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <StatGrid>
            <StatCard
              label="Sự kiện"
              value={loading ? null : stats.total}
              icon={<CalendarDays />}
            />
            <StatCard label="Đang bán" value={loading ? null : stats.published} icon={<Radio />} />
            <StatCard label="Nháp" value={loading ? null : stats.draft} icon={<FilePen />} />
            {/*
                Bấm được: ô này cảnh báo một nhóm cần xử lý, nên nó phải mở ra được chính nhóm ấy.
                `StatCard` không nhận `onClick`, và bọc ngoài bằng <button> sẽ lồng nút trong nút —
                nên dùng một lớp bao bấm được, có bàn phím, không phải nút.
              */}
            <div
              role="button"
              tabIndex={0}
              aria-pressed={session === 'no-session'}
              className="cursor-pointer rounded-[var(--nt-radius)] focus-visible:shadow-[var(--nt-focus)] focus-visible:outline-none"
              onClick={() => setSession(session === 'no-session' ? '' : 'no-session')}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSession(session === 'no-session' ? '' : 'no-session');
                }
              }}
            >
              <StatCard
                label="Chưa có suất"
                icon={<CalendarClock />}
                value={loading ? null : stats.noSession}
                tone={stats.noSession > 0 ? 'warn' : 'default'}
                hint={session === 'no-session' ? 'Đang lọc — bấm để bỏ' : 'Bấm để xem nhóm này'}
              />
            </div>
          </StatGrid>

          <FilterBar
            actions={
              <Button
                variant="secondary"
                disabled={!filtering}
                onClick={() => {
                  setQuery('');
                  setStatus('');
                  setCategory('');
                  setVenue('');
                  setSession('');
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
            {/* Ẩn hẳn khi tổ chức chỉ có một địa điểm: một mục chọn luôn cho ra cùng kết quả là
                một mục chiếm chỗ mà không trả lời câu hỏi nào. */}
            {venueOptions.length > 1 ? (
              <Select
                label="Địa điểm"
                value={venue}
                placeholder="Mọi địa điểm"
                options={venueOptions}
                onChange={(event) => setVenue(event.target.value)}
              />
            ) : null}
            <Select
              label="Suất diễn"
              value={session}
              options={SESSION_FILTERS}
              onChange={(event) => setSession(event.target.value)}
            />
          </FilterBar>

          <div>
            <Table<AdminEventRow>
              caption="Danh sách sự kiện"
              loading={loading}
              rows={visible}
              rowKey={(row) => row.id}
              // Bấm vào dòng là XEM sự kiện bán thế nào — việc người ta làm nhiều nhất ở bảng này.
              // Đường sửa suất và giá vẫn là một nút riêng ở cột cuối.
              onRowClick={(row) =>
                router.push(`/events/${row.id}/master-data?org=${organizationId}`)
              }
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
                  // Link thật chứ không chỉ dựa vào `onRowClick`: mở tab mới, sao chép địa chỉ và
                  // điều hướng bằng bàn phím đều đi qua thẻ <a>, không đi qua sự kiện click.
                  cell: (row) => (
                    <div className="grid gap-0.5">
                      <Link
                        href={`/events/${row.id}/master-data?org=${organizationId}`}
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
                    <Badge tone={eventStatusTone(row.status)}>{eventStatusLabel(row.status)}</Badge>
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
                      {canTogglePublish(row.status) ? (
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
                      ) : null}
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

      {templateOpen ? (
        <CreateFromTemplateDialog
          organizationId={organizationId}
          onClose={() => setTemplateOpen(false)}
        />
      ) : null}
    </>
  );
}

/**
 * Sự kiện chưa có suất xếp cuối khi sắp theo "suất gần nhất".
 *
 * `null` mà quy về 0 thì chúng nhảy lên đầu bảng như thể sắp diễn ra tới nơi — đúng ngược với sự
 * thật là chúng chưa bán được vé nào.
 */
/**
 * Sự kiện có khớp bộ lọc suất diễn không.
 *
 * `nextSessionAt` là suất **sắp tới gần nhất**, và backend chỉ tính suất còn ở tương lai. Nên
 * `null` có hai nghĩa gộp lại: chưa khai suất nào, hoặc mọi suất đã diễn ra. `sessionCount` tách
 * được hai trường hợp ấy — và chúng cần xử lý khác hẳn nhau: một bên là việc chưa làm, một bên là
 * sự kiện đã xong.
 */
function matchesSession(row: AdminEventRow, filter: string, now: number): boolean {
  if (filter === 'no-session') return row.sessionCount === 0;

  const upcoming = row.nextSessionAt !== null && Date.parse(row.nextSessionAt) >= now;
  if (filter === 'upcoming') return upcoming;
  // "Đã diễn ra hết" KHÔNG bao gồm sự kiện chưa khai suất nào — nhóm đó có mục riêng, và gộp vào
  // đây sẽ nói rằng một bản nháp vừa tạo đã diễn ra xong.
  if (filter === 'past') return !upcoming && row.sessionCount > 0;
  return true;
}

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
