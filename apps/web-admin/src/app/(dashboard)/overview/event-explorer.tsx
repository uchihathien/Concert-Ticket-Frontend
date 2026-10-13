'use client';

import {
  useEventMasterData,
  useOrganizationDashboard,
  type AdminEventRow,
  type OrganizationDashboard,
  type OrganizationSummary,
} from '@nexaticket/ts-sdk';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  EVENT_CATEGORY_FILTERS,
  FilterBar,
  Input,
  Pagination,
  Panel,
  Section,
  Select,
  Skeleton,
  Table,
  eventCategoryLabel,
  foldText,
  formatDate,
  formatNumber,
  matchesText,
  useDebouncedValue,
} from '@nexaticket/ui';
import { TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EventMasterPanel } from '@/components/EventMasterPanel';
import styles from './overview.module.css';

/** Đủ để quét, không đủ để phải cuộn hai lần. Khớp con số dùng ở trang Vé đã bán. */
const PAGE_SIZE = 10;

/**
 * Bảng sự kiện và master data của sự kiện đang chọn — phần "tra cứu" của trang Tổng quan.
 *
 * <h3>Nguồn số liệu khác với các thẻ thống kê phía trên</h3>
 *
 * Khối master data ghép catalog + inventory + analytics-service ở backend
 * (`OrganizationDashboardQuery`). Số vé và doanh thu trong đó là số CỘNG DỒN mà analytics nhận qua
 * event, còn các thẻ thống kê đọc thẳng đơn hàng ở ordering-service. Hai nguồn có thể lệch nhau nếu
 * analytics bỏ lỡ event — nên khối này luôn ghi rõ nguồn của nó.
 *
 * <h3>Bộ lọc chạy ở client, và đó là quyết định có giới hạn</h3>
 *
 * `useOrganizationDashboard` trả về **toàn bộ** sự kiện của tổ chức trong một payload, nên lọc và
 * phân trang ở đây chỉ là cắt một mảng đã có. Đúng ở quy mô một ban tổ chức (hàng chục sự kiện).
 *
 * <h3>"0" và "chưa biết" không được trông giống nhau</h3>
 *
 * Backend trả 200 kèm `degraded` khi một service phía sau im lặng. Trang hiện "—" cho con số chưa
 * hỏi được; hiện "0đ" là báo sai cho ban tổ chức về chính tiền của họ.
 */
export function EventExplorer({ organization }: { organization: OrganizationSummary }) {
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
      <Panel>
        <Skeleton lines={4} />
      </Panel>
    );
  }

  if (dashboard.isError) {
    return (
      <ErrorState error={null} onRetry={() => void dashboard.refetch()} />
    );
  }

  const data = dashboard.data as OrganizationDashboard;
  const salesDown = data.degraded.length > 0;

  return (
    <>
      {salesDown ? <DegradedNotice services={data.degraded} /> : null}

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

          <div>
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
          </div>

          {activeEventId === null ? null : (
            <Section
              title="Master data của sự kiện"
              description="Toàn bộ số liệu và cấu hình của sự kiện đang chọn. Số vé và doanh thu trong khối này lấy từ dịch vụ analytics (cộng dồn từ trước tới nay), nên có thể lệch với các thẻ thống kê phía trên — các thẻ ấy đọc thẳng đơn hàng."
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
