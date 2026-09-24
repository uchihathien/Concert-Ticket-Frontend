'use client';

import {
  useAdminEvent,
  useOrganizationDashboard,
  useOrganizationTickets,
  type OrganizationSummary,
  type OrganizationTicket,
  type TicketPaymentStatus,
  type TicketStatus,
} from '@nexaticket/ts-sdk';
import {
  Badge,
  Button,
  ErrorState,
  FilterBar,
  Input,
  PageHeader,
  Pagination,
  Select,
  Table,
  formatDateTime,
  formatNumber,
  useDebouncedValue,
  type BadgeTone,
} from '@nexaticket/ui';
import { useMemo, useState } from 'react';
import { OrganizationGate } from '@/components/OrganizationGate';

/**
 * A-TICKETS — tra cứu vé đã bán.
 *
 * <h3>Lọc ở backend, không ở đây</h3>
 *
 * Trang Sự kiện lọc bằng `matchesText` ngay trong trình duyệt, và điều đó đúng ở đó: một tổ chức
 * có vài chục sự kiện. Ở đây thì một sự kiện có hàng chục nghìn vé — tải hết về rồi lọc là tải
 * vài megabyte để hiện 50 dòng, và nó hỏng đúng vào sự kiện lớn nhất, tức là lúc cần nhất.
 *
 * <h3>Một ô tìm kiếm, không phải ba</h3>
 *
 * Người trực tổng đài không biết trước khách sắp đọc cho mình mã vé, mã ghế hay tên. Backend tra
 * cả ba cột từ cùng một chuỗi. Ba ô riêng biệt bắt người dùng phân loại thông tin trước khi gõ —
 * trong khi họ đang nghe điện thoại.
 */
export default function TicketsPage() {
  return (
    <OrganizationGate title="Vé đã bán">
      {(organization) => <TicketsBody organization={organization} />}
    </OrganizationGate>
  );
}

const STATUS_OPTIONS = [
  { value: '', label: 'Mọi trạng thái' },
  { value: 'VALID', label: 'Chưa vào cửa' },
  { value: 'CHECKED_IN', label: 'Đã vào cửa' },
  { value: 'REVOKED', label: 'Đã thu hồi' },
];

const PAYMENT_OPTIONS = [
  { value: '', label: 'Mọi thanh toán' },
  { value: 'PAID', label: 'Đã thanh toán' },
  { value: 'REFUNDED', label: 'Đã hoàn tiền' },
];

const PAGE_SIZE = 50;

function TicketsBody({ organization }: { organization: OrganizationSummary }) {
  const [query, setQuery] = useState('');
  const [eventId, setEventId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [zoneCode, setZoneCode] = useState('');
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [page, setPage] = useState(0);

  // Gõ "Nguyễn" là 6 phím. Không có bước chậm lại thì đó là 6 lần quét database, 5 lần trong đó
  // bị bỏ đi ngay khi vừa về.
  const debouncedQuery = useDebouncedValue(query, 350);

  const dashboard = useOrganizationDashboard(organization.id);
  // Suất diễn và khu vực chỉ biết được khi đã chọn một sự kiện — chúng là thuộc tính của sự kiện
  // đó, không phải của tổ chức.
  const event = useAdminEvent(organization.id, eventId || null);

  const params = useMemo(
    () => ({
      eventSessionId: sessionId || undefined,
      query: debouncedQuery || undefined,
      zoneCode: zoneCode || undefined,
      status: (status || undefined) as TicketStatus | undefined,
      paymentStatus: (paymentStatus || undefined) as TicketPaymentStatus | undefined,
      page,
      size: PAGE_SIZE,
    }),
    [sessionId, debouncedQuery, zoneCode, status, paymentStatus, page],
  );

  const tickets = useOrganizationTickets(organization.id, params);

  /** Mọi lần đổi bộ lọc đều phải về trang 1: trang 4 của bộ lọc cũ thường rỗng ở bộ lọc mới. */
  function changeFilter<T>(set: (value: T) => void) {
    return (value: T) => {
      set(value);
      setPage(0);
    };
  }

  const sessions = event.data?.sessions ?? [];
  const zones = event.data?.venue.zones ?? [];
  const rows = tickets.data?.rows ?? [];
  const total = tickets.data?.total ?? 0;

  return (
    <>
      <PageHeader title="Vé đã bán" description={organization.name} />

      <FilterBar
        count={
          tickets.isPending
            ? 'Đang tìm…'
            : `${formatNumber(total)} vé khớp bộ lọc` +
              (total > rows.length ? ` · đang xem ${rows.length}` : '')
        }
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              setQuery('');
              setEventId('');
              setSessionId('');
              setZoneCode('');
              setStatus('');
              setPaymentStatus('');
              setPage(0);
            }}
          >
            Xoá bộ lọc
          </Button>
        }
      >
        <Input
          label="Tìm kiếm"
          placeholder="Mã vé, mã ghế hoặc tên khách"
          value={query}
          onChange={(e) => changeFilter(setQuery)(e.target.value)}
        />
        <Select
          label="Sự kiện"
          placeholder="Mọi sự kiện"
          value={eventId}
          options={(dashboard.data?.events ?? []).map((row) => ({
            value: row.id,
            label: row.title,
          }))}
          onChange={(e) => {
            // Đổi sự kiện thì suất và khu của sự kiện cũ không còn nghĩa gì — giữ lại chúng sẽ
            // cho ra một bộ lọc không bao giờ khớp dòng nào, và không có gì nói vì sao.
            changeFilter(setEventId)(e.target.value);
            setSessionId('');
            setZoneCode('');
          }}
        />
        <Select
          label="Suất diễn"
          placeholder="Mọi suất"
          value={sessionId}
          disabled={!eventId}
          options={sessions.map((session) => ({
            value: session.id,
            label: formatDateTime(session.startsAt),
          }))}
          onChange={(e) => changeFilter(setSessionId)(e.target.value)}
        />
        <Select
          label="Khu vực"
          placeholder="Mọi khu"
          value={zoneCode}
          disabled={!eventId}
          options={zones.map((zone) => ({
            value: zone.zoneCode,
            label: `${zone.zoneCode} · ${zone.name}`,
          }))}
          onChange={(e) => changeFilter(setZoneCode)(e.target.value)}
        />
        <Select
          label="Vào cửa"
          value={status}
          options={STATUS_OPTIONS}
          onChange={(e) => changeFilter(setStatus)(e.target.value)}
        />
        <Select
          label="Thanh toán"
          value={paymentStatus}
          options={PAYMENT_OPTIONS}
          onChange={(e) => changeFilter(setPaymentStatus)(e.target.value)}
        />
      </FilterBar>

      {tickets.isError ? (
        <ErrorState error={null} onRetry={() => void tickets.refetch()} />
      ) : (
        <>
          <Table<OrganizationTicket>
            caption="Vé đã phát hành"
            rows={rows}
            rowKey={(row) => row.ticketId}
            loading={tickets.isPending}
            emptyTitle="Không có vé nào khớp"
            emptyDescription="Thử bỏ bớt một tiêu chí, hoặc kiểm tra lại mã vé."
            columns={[
              {
                key: 'holder',
                header: 'Khách',
                // Tên có thể trống khi identity không trả lời được lúc phát vé. Dấu gạch nói rõ
                // "không có dữ liệu"; ô trống đọc như bảng chưa tải xong.
                cell: (row) => row.holderName ?? '—',
              },
              {
                key: 'seat',
                header: 'Chỗ',
                cell: (row) => (
                  <span>
                    {row.zoneCode}
                    {row.seatLabel ? ` · ${row.seatLabel}` : ''}
                  </span>
                ),
              },
              { key: 'type', header: 'Hạng vé', cell: (row) => row.ticketTypeName },
              {
                key: 'status',
                header: 'Vào cửa',
                cell: (row) => <Badge tone={statusTone(row.status)}>{statusLabel(row.status)}</Badge>,
              },
              {
                key: 'payment',
                header: 'Thanh toán',
                cell: (row) => (
                  <Badge tone={row.paymentStatus === 'REFUNDED' ? 'danger' : 'neutral'}>
                    {row.paymentStatus === 'REFUNDED' ? 'Đã hoàn tiền' : 'Đã thanh toán'}
                  </Badge>
                ),
              },
              {
                key: 'checkedInAt',
                header: 'Lúc',
                cell: (row) => (row.checkedInAt ? formatDateTime(row.checkedInAt) : '—'),
              },
              {
                key: 'code',
                header: 'Mã vé',
                // Tám ký tự đầu là đủ để đối chiếu với mã khách đọc qua điện thoại, và đủ ngắn để
                // không đẩy cột nào ra khỏi màn hình.
                cell: (row) => <code>{row.ticketId.slice(0, 8)}</code>,
              },
            ]}
          />

          <Pagination
            page={page}
            received={rows.length}
            pageSize={PAGE_SIZE}
            onChange={setPage}
            label={`Trang ${page + 1}`}
          />
        </>
      )}
    </>
  );
}

function statusLabel(status: TicketStatus): string {
  switch (status) {
    case 'CHECKED_IN':
      return 'Đã vào cửa';
    case 'REVOKED':
      return 'Đã thu hồi';
    default:
      return 'Chưa vào cửa';
  }
}

function statusTone(status: TicketStatus): BadgeTone {
  switch (status) {
    case 'CHECKED_IN':
      return 'success';
    case 'REVOKED':
      return 'danger';
    default:
      return 'neutral';
  }
}
