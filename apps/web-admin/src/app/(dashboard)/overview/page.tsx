'use client';

import {
  useEventMasterData,
  useOrganizationDashboard,
  type AdminEventRow,
  type EventSales,
  type OrganizationDashboard,
  type OrganizationSummary,
} from '@nexaticket/ts-sdk';
import {
  Badge,
  BarChart,
  Button,
  EmptyState,
  ErrorState,
  EVENT_CATEGORY_FILTERS,
  FilterBar,
  Input,
  PageHeader,
  Pagination,
  Panel,
  Section,
  Select,
  Skeleton,
  StatCard,
  StatGrid,
  Table,
  eventCategoryLabel,
  foldText,
  formatDate,
  formatNumber,
  matchesText,
  useDebouncedValue,
} from '@nexaticket/ui';
import { CalendarDays, Ticket, TriangleAlert, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EventMasterPanel } from '@/components/EventMasterPanel';
import { OrganizationGate } from '@/components/OrganizationGate';
import styles from './overview.module.css';

/** Đủ để quét, không đủ để phải cuộn hai lần. Khớp con số dùng ở trang Vé đã bán. */
const PAGE_SIZE = 10;

/**
 * A-OVERVIEW — bảng điều khiển của ban tổ chức.
 *
 * <h3>Một hàng bộ lọc, một bảng chọn, một khối master data</h3>
 *
 * Chọn một sự kiện là nạp **toàn bộ** master data của nó trong một request: chi tiết, khu vực,
 * trạng thái từng chỗ theo khu, hạng vé và giá, trần mua, số bán và doanh thu theo từng suất. Việc
 * ghép ba service nằm ở backend (`OrganizationDashboardQuery`) chứ không ở đây — bốn app frontend
 * tự ghép là bốn bản sao của cùng quy tắc, và bản lệch là bản ban tổ chức dùng để ra quyết định.
 *
 * <h3>Vì sao bảng chọn thay cho ô dropdown</h3>
 *
 * Bản trước dùng một `Select`. Nó đủ cho ba sự kiện và sai hẳn ở ba mươi: không tìm được theo tên,
 * không thấy được trạng thái hay ngày công bố trước khi chọn, và chọn sai thì phải mở lại danh sách
 * để đoán tiếp. Bảng có lọc và phân trang trả lời được "sự kiện nào đang có vấn đề" **trước** khi
 * người dùng phải chọn một cái.
 *
 * <h3>Bộ lọc chạy ở client, và đó là quyết định có giới hạn</h3>
 *
 * `useOrganizationDashboard` trả về **toàn bộ** sự kiện của tổ chức trong một payload, nên lọc và
 * phân trang ở đây chỉ là cắt một mảng đã có — không thêm request nào, và đổi bộ lọc là tức thì.
 * Đúng ở quy mô một ban tổ chức (hàng chục sự kiện). Khi nào một tổ chức có hàng nghìn sự kiện thì
 * phải đẩy cả ba thứ xuống backend; lúc đó `Pagination` ở đây đã nhận đúng hình dạng
 * `page`/`received`/`pageSize` mà một endpoint phân trang thật sẽ trả về.
 *
 * <h3>"0" và "chưa biết" không được trông giống nhau</h3>
 *
 * Backend trả 200 kèm `degraded` khi một service phía sau im lặng, thay vì 500 cho cả trang. Nên
 * `grossVnd: 0` có hai nghĩa: "chưa bán được đồng nào" và "không hỏi được doanh thu". Trang này
 * hiện "—" cho nghĩa thứ hai. Hiện "0đ" là báo sai cho ban tổ chức về chính tiền của họ.
 */
export default function OverviewPage() {
  return (
    <OrganizationGate title="Tổng quan">
      {(organization) => <OverviewBody organization={organization} />}
    </OrganizationGate>
  );
}

function OverviewBody({ organization }: { organization: OrganizationSummary }) {
  const dashboard = useOrganizationDashboard(organization.id);

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(0);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Gõ tới ký tự thứ ba rồi lọc: 350ms giống trang Vé đã bán, để hai màn hình phản ứng cùng một
  // nhịp. Ở đây lọc không gọi mạng, nhưng nhịp trễ vẫn giữ cho bảng không nhảy theo từng phím.
  const debouncedQuery = useDebouncedValue(query, 350);
  const needle = foldText(debouncedQuery.trim());

  const events = useMemo(() => dashboard.data?.events ?? [], [dashboard.data]);

  const filtered = useMemo(
    () =>
      events.filter((row) => {
        if (status && row.status !== status) return false;
        if (category !== 'all' && row.category !== category) return false;
        // Tìm cả theo tên địa điểm: ban tổ chức nhớ "sự kiện ở Nhà hát Lớn" thường xuyên hơn nhớ
        // đúng tên chương trình. `matchesText` bỏ dấu nên "nha hat lon" cũng khớp.
        return matchesText(needle, [row.title, row.venueName, row.slug]);
      }),
    [events, status, category, needle],
  );

  const paged = useMemo(
    () => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [filtered, page],
  );

  // Sự kiện đang xem: lựa chọn của người dùng nếu nó còn trong kết quả lọc, ngược lại là dòng đầu
  // trang hiện tại. Giữ nguyên một lựa chọn đã bị bộ lọc cắt đi sẽ hiện master data của một sự kiện
  // không còn nằm trong bảng bên trên — người đọc không có cách nào biết mình đang xem cái gì.
  const activeEventId = paged.some((row) => row.id === selectedEventId)
    ? selectedEventId
    : (paged[0]?.id ?? null);
  const masterData = useEventMasterData(organization.id, activeEventId);

  function changeFilter<T>(set: (value: T) => void) {
    return (value: T) => {
      set(value);
      // Đổi bộ lọc luôn về trang 1: ở lại trang 4 của một kết quả chỉ còn hai dòng là một bảng
      // trống, và người dùng đọc nó thành "không có gì khớp".
      setPage(0);
    };
  }

  if (dashboard.isPending) {
    return (
      <>
        <PageHeader title="Tổng quan" description={organization.name} />
        <Panel>
          <Skeleton lines={4} />
        </Panel>
      </>
    );
  }

  if (dashboard.isError) {
    return (
      <>
        <PageHeader title="Tổng quan" description={organization.name} />
        <ErrorState error={null} onRetry={() => void dashboard.refetch()} />
      </>
    );
  }

  const data = dashboard.data as OrganizationDashboard;
  const salesDown = data.degraded.length > 0;

  return (
    <>
      <PageHeader title="Tổng quan" description={organization.name} />

      {salesDown ? <DegradedNotice services={data.degraded} /> : null}

      <StatGrid>
        <StatCard
          label="Sự kiện"
          value={data.totals.eventCount}
          hint={`${data.totals.publishedCount} đang bán · ${data.totals.draftCount} nháp`}
          icon={<CalendarDays size={16} aria-hidden="true" />}
        />
        <StatCard
          label="Sức chứa đã khai"
          value={data.totals.capacity}
          hint="Gồm cả sự kiện còn nháp"
          icon={<Users size={16} aria-hidden="true" />}
        />
        {/* `null` khi analytics im lặng: StatCard vẽ khối chờ thay vì con số 0 sai sự thật. */}
        <StatCard
          label="Vé đã bán"
          value={salesDown ? null : data.totals.ticketsSold}
          hint={salesDown ? 'Chưa hỏi được' : 'Toàn tổ chức'}
          icon={<Ticket size={16} aria-hidden="true" />}
        />
        <StatCard
          label="Doanh thu"
          value={salesDown ? null : data.totals.grossVnd}
          hint={salesDown ? 'Chưa hỏi được' : 'Tổng khách trả'}
        />
      </StatGrid>

      {events.length === 0 ? (
        <EmptyState
          title="Chưa có sự kiện nào"
          description="Dựng sự kiện đầu tiên ở mục Sự kiện, hoặc chọn một khung concert của Tổng công ty."
        />
      ) : (
        <>
          {/*
            MỘT hàng bộ lọc, đặt trên mọi thứ nó chi phối. Bộ lọc nằm trong từng thẻ sẽ khiến hai
            khối cạnh nhau hiển thị hai lát dữ liệu khác nhau mà không có gì nói ra điều đó.
          */}
          <FilterBar
            count={`${formatNumber(filtered.length)}/${formatNumber(events.length)} sự kiện khớp bộ lọc`}
            actions={
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery('');
                  setStatus('');
                  setCategory('all');
                  setPage(0);
                }}
              >
                Xoá bộ lọc
              </Button>
            }
          >
            <Input
              label="Tìm kiếm"
              placeholder="Tên sự kiện hoặc địa điểm"
              value={query}
              onChange={(event) => changeFilter(setQuery)(event.target.value)}
            />
            <Select
              label="Trạng thái"
              value={status}
              onChange={(event) => changeFilter(setStatus)(event.target.value)}
              options={[
                { value: '', label: 'Mọi trạng thái' },
                { value: 'PUBLISHED', label: 'Đang bán' },
                { value: 'DRAFT', label: 'Nháp' },
                { value: 'UNPUBLISHED', label: 'Đã rút xuống' },
                { value: 'CANCELLED', label: 'Đã huỷ' },
              ]}
            />
            <Select
              label="Phân loại"
              value={category}
              onChange={(event) => changeFilter(setCategory)(event.target.value)}
              options={EVENT_CATEGORY_FILTERS.map((item) => ({
                value: item.value,
                label: item.label,
              }))}
            />
          </FilterBar>

          {/*
            Biểu đồ đặt DƯỚI hàng bộ lọc và TRÊN bảng: nó vẽ đúng lát dữ liệu mà bộ lọc vừa cắt, nên
            nó phải nằm trong cùng dòng đọc ấy. Đặt nó trong một thẻ có bộ lọc riêng sẽ cho hai khối
            cạnh nhau hiển thị hai lát khác nhau mà không có gì nói ra điều đó.
          */}
          <Panel>
            <TopEventsChart rows={filtered} sales={data.eventSales} down={salesDown} />
          </Panel>

          <Panel>
            <Table<AdminEventRow>
              caption="Sự kiện của tổ chức"
              rows={paged}
              rowKey={(row) => row.id}
              emptyTitle="Không có sự kiện nào khớp bộ lọc"
              emptyDescription="Thử xoá bộ lọc, hoặc tìm bằng tên địa điểm."
              onRowClick={(row) => setSelectedEventId(row.id)}
              columns={[
                {
                  key: 'title',
                  header: 'Sự kiện',
                  cell: (row) => (
                    <span className={row.id === activeEventId ? styles.activeRow : undefined}>
                      {row.title}
                    </span>
                  ),
                },
                { key: 'venue', header: 'Địa điểm', cell: (row) => row.venueName ?? '—' },
                {
                  key: 'category',
                  header: 'Phân loại',
                  cell: (row) => eventCategoryLabel(row.category),
                },
                {
                  key: 'status',
                  header: 'Trạng thái',
                  cell: (row) => <EventStatusBadge status={row.status} />,
                },
                {
                  key: 'published',
                  header: 'Công bố',
                  cell: (row) => (row.publishedAt ? formatDate(row.publishedAt) : '—'),
                },
                {
                  key: 'pick',
                  header: '',
                  cell: (row) => (
                    // `<tr>` không nhận focus bàn phím, nên mỗi dòng vẫn phải có một nút thật —
                    // bấm cả dòng chỉ là tiện ích cho chuột.
                    <Button
                      variant="ghost"
                      aria-label={`Xem số liệu của ${row.title}`}
                      onClick={() => setSelectedEventId(row.id)}
                    >
                      {row.id === activeEventId ? 'Đang xem' : 'Xem'}
                    </Button>
                  ),
                },
              ]}
            />
            <Pagination
              page={page}
              received={paged.length}
              pageSize={PAGE_SIZE}
              onChange={setPage}
            />
          </Panel>

          {activeEventId === null ? null : (
            <Section
              title="Master data của sự kiện"
              description="Toàn bộ số liệu và cấu hình của sự kiện đang chọn."
            >
              <EventMaster
                query={masterData}
                organization={organization}
                onRetry={() => void masterData.refetch()}
              />
            </Section>
          )}
        </>
      )}
    </>
  );
}

function EventStatusBadge({ status }: { status: AdminEventRow['status'] }) {
  if (status === 'PUBLISHED') return <Badge tone="success">Đang bán</Badge>;
  if (status === 'CANCELLED') return <Badge tone="danger">Đã huỷ</Badge>;
  if (status === 'UNPUBLISHED') return <Badge tone="warn">Đã rút xuống</Badge>;
  return <Badge tone="neutral">Nháp</Badge>;
}

/**
 * Nói rõ service nào im lặng, không nói chung chung "có lỗi".
 *
 * Ban tổ chức không sửa được sự cố, nhưng họ cần biết con số nào đang thiếu để không ra quyết định
 * dựa vào nó — và để nói đúng chuyện khi gọi hỗ trợ.
 */
function DegradedNotice({ services }: { services: string[] }) {
  return (
    <Panel className={styles.degraded}>
      <TriangleAlert size={18} aria-hidden="true" />
      <div>
        <p className={styles.degradedTitle}>Một phần số liệu chưa hỏi được</p>
        <p className={styles.degradedBody}>
          Không kết nối được: {services.join(', ')}. Những ô hiện dấu “—” chưa có số, không phải
          bằng 0.
        </p>
      </div>
    </Panel>
  );
}

/**
 * Giữ bản dựng cũ trong lúc bản mới đang về.
 *
 * `useEventMasterData` bật `keepPreviousData`, nên `isPending` chỉ đúng ở lần nạp ĐẦU TIÊN. Đổi sự
 * kiện thì `data` vẫn là của sự kiện trước và `isFetching` bật — hiện khung xương lúc đó là một cú
 * nháy cả màn hình và bảng bên trên nhảy chỗ ngay dưới con trỏ.
 */
function EventMaster({
  query,
  organization,
  onRetry,
}: {
  query: ReturnType<typeof useEventMasterData>;
  organization: OrganizationSummary;
  onRetry: () => void;
}) {
  if (query.isPending) {
    return <Skeleton lines={6} />;
  }
  if (query.isError) {
    return <ErrorState error={null} onRetry={onRetry} />;
  }

  return (
    <div className={query.isFetching ? styles.stale : undefined}>
      <EventMasterPanel data={query.data} organization={organization} />
    </div>
  );
}

/**
 * Doanh thu theo sự kiện, trong phạm vi bộ lọc hiện tại.
 *
 * <h3>Chỉ vẽ tám sự kiện dẫn đầu</h3>
 *
 * Một tổ chức có ba mươi sự kiện thì ba mươi thanh không còn là biểu đồ — nó là một bảng vẽ bằng
 * hình. Tám dòng là số đọc được trong một lần nhìn, và phần còn lại vẫn đọc được đầy đủ ở bảng ngay
 * bên dưới. Đây là lý do "gộp phần đuôi lại" tồn tại: biểu đồ trả lời "ai dẫn đầu", bảng trả lời
 * "còn những ai".
 *
 * <h3>Không xếp theo doanh thu thì biểu đồ này vô nghĩa</h3>
 *
 * Bảng bên dưới giữ thứ tự của backend (theo ngày tạo) vì đó là thứ tự người dùng mong đợi khi rà
 * soát. Biểu đồ thì xếp giảm dần: một biểu đồ thanh không xếp hạng buộc người đọc tự tìm thanh dài
 * nhất bằng mắt, đúng việc mà xếp hạng làm hộ họ.
 */
function TopEventsChart({
  rows,
  sales,
  down,
}: {
  rows: AdminEventRow[];
  sales: EventSales[];
  down: boolean;
}) {
  const top = useMemo(() => {
    // Nối theo id ở client: backend trả số bán thành một danh sách rời để `AdminEventRow` không
    // phải mang hai cột mà chỉ màn hình này cần. Sự kiện không có mặt trong `sales` là sự kiện chưa
    // bán được vé nào — nó rơi khỏi biểu đồ, và vẫn còn nguyên ở bảng bên dưới.
    const byEvent = new Map(sales.map((item) => [item.eventId, item]));
    return rows
      .flatMap((row) => {
        const sold = byEvent.get(row.id);
        return sold && sold.grossVnd > 0 ? [{ row, sold }] : [];
      })
      .sort((a, b) => b.sold.grossVnd - a.sold.grossVnd)
      .slice(0, 8);
  }, [rows, sales]);

  if (down) {
    return <p className={styles.chartEmpty}>Chưa hỏi được doanh thu từ analytics.</p>;
  }
  if (top.length === 0) {
    return (
      <p className={styles.chartEmpty}>Chưa có sự kiện nào bán được vé trong phạm vi bộ lọc này.</p>
    );
  }

  return (
    <BarChart
      caption={
        rows.length > top.length
          ? `Doanh thu theo sự kiện · ${top.length} sự kiện dẫn đầu`
          : 'Doanh thu theo sự kiện'
      }
      rows={top.map(({ row, sold }) => ({
        key: row.id,
        label: row.title,
        value: sold.grossVnd,
        hint: `${formatNumber(sold.ticketsSold)} vé đã bán`,
      }))}
      format={(value) => `${formatNumber(value)}đ`}
    />
  );
}
