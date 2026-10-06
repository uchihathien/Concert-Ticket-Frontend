'use client';

import {
  ApiError,
  useAdminEvents,
  useOrganizationSales,
  type OrganizationSummary,
  type SessionSales,
} from '@nexaticket/ts-sdk';
import {
  BarChart,
  type BarChartRow,
  Button,
  EmptyState,
  ErrorState,
  FilterBar,
  Input,
  MoneyText,
  PageHeader,
  Panel,
  Select,
  Skeleton,
  Table,
  foldText,
  formatNumber,
  matchesText,
} from '@nexaticket/ui';
import { Banknote, PlugZap, ReceiptText, Ticket } from 'lucide-react';
import { useMemo, useState } from 'react';
import { OrganizationGate } from '@/components/OrganizationGate';

/**
 * A-SALES — doanh thu của tổ chức.
 *
 * Chỉ số vé và số tiền đã bán. Không hoa hồng, không số dư, không lịch chi trả — đó là ranh giới
 * cứng giữa miền của ban tổ chức và miền tài chính của superadmin (ADR-1010), và backend cũng
 * không có endpoint nào ở đây trả những thứ đó.
 */
export default function SalesPage() {
  return (
    <OrganizationGate title="Doanh thu">
      {(organization) => <SalesBody organization={organization} />}
    </OrganizationGate>
  );
}

function SalesBody({ organization }: { organization: OrganizationSummary }) {
  const sales = useOrganizationSales(organization.id);
  // Analytics chỉ trả `eventId`, không trả tên. Bảng sự kiện của chính tổ chức này là chỗ duy
  // nhất tra được tên — và nó đã nằm sẵn trong cache của trang Sự kiện.
  const events = useAdminEvents(organization.id);

  const [query, setQuery] = useState('');
  const [eventId, setEventId] = useState('');

  const titleOf = useMemo(
    () => new Map((events.data ?? []).map((event) => [event.id, event.title])),
    [events.data],
  );

  /**
   * Lọc tại chỗ, và ở đây điều đó đúng: `GET …/sales` trả **toàn bộ** suất trong một payload, nên
   * dữ liệu đã nằm sẵn trong bộ nhớ. Khác hẳn trang Nhật ký — nó phân trang ở server, và một ô
   * tìm kiếm client-side ở đó chỉ tìm trong trang đang xem.
   *
   * Sắp theo doanh thu giảm dần giữ nguyên sau khi lọc: câu hỏi của màn này luôn là "suất nào
   * mang về nhiều tiền nhất", kể cả khi đã thu hẹp về một sự kiện.
   */
  const rows = useMemo(() => {
    const needle = foldText(query.trim());
    return [...(sales.data?.sessions ?? [])]
      .filter((row) => {
        if (eventId && row.eventId !== eventId) return false;
        // Tìm cả theo mã: sự kiện đã xoá khỏi bảng quản trị vẫn còn số liệu và chỉ hiện ra mã.
        return matchesText(needle, [titleOf.get(row.eventId), row.eventId]);
      })
      .sort((a, b) => b.grossVnd - a.grossVnd);
  }, [sales.data, query, eventId, titleOf]);

  if (sales.isPending) {
    return (
      <>
        <PageHeader title="Doanh thu" description={organization.name} />
        <Panel>
          <Skeleton lines={4} />
        </Panel>
      </>
    );
  }

  if (sales.isError) {
    return (
      <>
        <PageHeader title="Doanh thu" description={organization.name} />
        <ServiceUnavailableNotice error={sales.error} onRetry={() => void sales.refetch()} />
      </>
    );
  }

  const filtering = Boolean(query.trim() || eventId);
  const totals = rows.reduce(
    (sum, row) => ({
      tickets: sum.tickets + row.ticketsSold,
      gross: sum.gross + row.grossVnd,
      ordersPaid: sum.ordersPaid + row.ordersPaid,
    }),
    { tickets: 0, gross: 0, ordersPaid: 0 },
  );
  const chartRows = revenueByEvent(rows, (id) => titleOf.get(id));

  return (
    <>
      <PageHeader title="Doanh thu" description={organization.name} />

      <div className="grid gap-4">
        {/* Hai ô số: dưới 640px xếp dọc. Một con số tiền bị bóp còn nửa màn hình điện thoại là
            một con số phải đọc hai lần. */}
        {/*
          Hai ô số cộng theo phần ĐANG LỌC, không phải tổng của cả tổ chức.

          Lý do: một ô số đứng yên trong khi bảng bên dưới đổi sẽ đọc như hai câu trả lời cho cùng
          một câu hỏi. Khi có bộ lọc, nhãn nói rõ đây là số của phần đã lọc.
        */}
        {/* Cùng ba con số với app Organizer; doanh thu đứng đầu vì là câu hỏi chính của trang. */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat
            label={filtering ? 'Doanh thu (đã lọc)' : 'Doanh thu'}
            value={<MoneyText amountVnd={totals.gross} strong />}
            icon={<Banknote />}
          />
          <Stat
            label={filtering ? 'Vé đã bán (đã lọc)' : 'Vé đã bán'}
            value={formatNumber(totals.tickets)}
            icon={<Ticket />}
          />
          <Stat
            label={filtering ? 'Đơn đã thanh toán (đã lọc)' : 'Đơn đã thanh toán'}
            value={formatNumber(totals.ordersPaid)}
            icon={<ReceiptText />}
          />
        </div>

        <FilterBar
          count={`${formatNumber(rows.length)} / ${formatNumber(
            sales.data.sessions.length,
          )} suất diễn`}
          actions={
            filtering ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery('');
                  setEventId('');
                }}
              >
                Xoá bộ lọc
              </Button>
            ) : undefined
          }
        >
          <Input
            label="Tìm sự kiện"
            placeholder="Tên sự kiện"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Select
            label="Sự kiện"
            placeholder="Mọi sự kiện"
            value={eventId}
            options={(events.data ?? []).map((event) => ({
              value: event.id,
              label: event.title,
            }))}
            onChange={(event) => setEventId(event.target.value)}
          />
        </FilterBar>

        {/*
          Biểu đồ nằm DƯỚI bộ lọc và TRÊN bảng: nó vẽ đúng lát dữ liệu bộ lọc vừa cắt, cùng dòng
          đọc với ba ô số và bảng. Gộp theo sự kiện (bảng bên dưới vẫn chi tiết theo suất).
        */}
        {chartRows.length > 0 ? (
          <Panel>
            <BarChart caption="Doanh thu theo sự kiện" rows={chartRows} format={formatMoneyShort} />
          </Panel>
        ) : null}

        {rows.length === 0 ? (
          // Hai câu khác nhau cho hai tình huống khác nhau: nói "chưa bán được vé nào" với người
          // vừa gõ nhầm một từ khoá là báo sai về chính doanh thu của họ.
          filtering ? (
            <EmptyState
              title="Không có suất nào khớp"
              description="Thử bỏ bớt từ khoá hoặc chọn lại sự kiện."
            />
          ) : (
            <EmptyState
              title="Chưa bán được vé nào"
              description="Số liệu xuất hiện ở đây sau đơn hàng đầu tiên được thanh toán."
            />
          )
        ) : (
          <div>
            <Table<SessionSales>
              caption="Doanh thu theo suất diễn"
              rows={rows}
              rowKey={(row) => row.eventSessionId}
              columns={[
                {
                  key: 'event',
                  header: 'Sự kiện',
                  // Sự kiện đã xoá khỏi bảng quản trị vẫn còn số liệu — hiện mã thay vì để trống,
                  // người dùng còn tra được.
                  cell: (row) => titleOf.get(row.eventId) ?? row.eventId,
                },
                {
                  key: 'tickets',
                  header: 'Vé đã bán',
                  cell: (row) => formatNumber(row.ticketsSold),
                  numeric: true,
                },
                {
                  key: 'gross',
                  header: 'Doanh thu',
                  cell: (row) => <MoneyText amountVnd={row.grossVnd} />,
                  numeric: true,
                },
                {
                  key: 'paid',
                  header: 'Đơn đã trả',
                  cell: (row) => formatNumber(row.ordersPaid),
                  numeric: true,
                },
                {
                  key: 'lost',
                  header: 'Quá hạn / huỷ',
                  cell: (row) => `${row.ordersExpired} / ${row.ordersCancelled}`,
                  numeric: true,
                },
              ]}
            />
          </div>
        )}
      </div>
    </>
  );
}

function Stat({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <Panel className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="m-0 text-[13px] font-medium text-muted">{label}</p>
        {/* `tabular-nums`: hai ô này đứng cạnh nhau và cùng cập nhật, chữ số lệch bề rộng làm cả
            hàng giật mỗi lần số đổi. */}
        <p className="m-0 mt-1.5 text-[28px] leading-tight font-bold tracking-tight tabular-nums">{value}</p>
      </div>
      {/* Cùng kiểu ô biểu tượng với StatCard của packages/ui. */}
      {icon ? (
        <span
          aria-hidden="true"
          className="grid size-9 flex-none place-items-center rounded-nt bg-accent text-primary-text [&_svg]:size-[18px]"
        >
          {icon}
        </span>
      ) : null}
    </Panel>
  );
}

/**
 * Màn lỗi riêng cho trang này.
 *
 * Tách khỏi `ErrorState` chung vì lỗi ở đây thường là hạ tầng. Không khẳng định gateway thiếu
 * route: route `/v1/admin/**` đã được khai báo; hướng dẫn kiểm tra route chỉ cần thiết nếu
 * analytics-service đã chạy mà request vẫn lỗi.
 */
function ServiceUnavailableNotice({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const apiError = error instanceof ApiError ? error : null;
  const notWired = apiError === null || apiError.status === 404 || apiError.status >= 500;

  if (!notWired) {
    return (
      <ErrorState
        error={apiError}
        correlationId={apiError?.correlationId ?? null}
        onRetry={onRetry}
      />
    );
  }

  return (
    <Panel>
      <h2 className="m-0 mb-2 flex items-center gap-2 text-lg font-bold">
        <PlugZap size={20} aria-hidden="true" className="text-warn" />
        Chưa kết nối được dịch vụ thống kê
      </h2>
      <p className="m-0 mb-2 text-muted">
        Màn hình này đọc <code>GET /v1/admin/organizations/{'{id}'}/sales</code> của
        analytics-service. Hiện đường đi chưa thông, nên đây là vấn đề hạ tầng chứ không phải tổ
        chức của bạn chưa có doanh thu.
      </p>
      <ul className="m-0 mb-3 list-disc ps-5 text-muted">
        <li>analytics-service (cổng 8099) cần được khởi động.</li>
        <li>
          Nếu analytics-service đã chạy mà vẫn lỗi, kiểm tra api-gateway đang chạy và route{' '}
          <code>/v1/admin/**</code> trỏ tới đúng địa chỉ dịch vụ.
        </li>
      </ul>
      {apiError?.correlationId ? (
        <p className="m-0 text-[13px] text-muted">Mã tra cứu: {apiError.correlationId}</p>
      ) : null}
    </Panel>
  );
}

/** Số thanh tối đa; phần còn lại gộp thành "Khác" — giống biểu đồ của app Organizer. */
const MAX_BARS = 6;

/**
 * Gộp doanh thu theo sự kiện cho biểu đồ, giảm dần; sự kiện chưa có doanh thu không vẽ (bảng bên
 * dưới vẫn liệt kê đủ). Chú giải khi trỏ vào thanh mang số vé và số đơn — phần mà app hiện khi chạm.
 */
function revenueByEvent(rows: SessionSales[], titleOf: (eventId: string) => string | undefined): BarChartRow[] {
  const groups = new Map<string, { gross: number; tickets: number; paid: number; expired: number; cancelled: number; sessions: number }>();
  for (const row of rows) {
    const group = groups.get(row.eventId) ?? { gross: 0, tickets: 0, paid: 0, expired: 0, cancelled: 0, sessions: 0 };
    group.gross += row.grossVnd;
    group.tickets += row.ticketsSold;
    group.paid += row.ordersPaid;
    group.expired += row.ordersExpired;
    group.cancelled += row.ordersCancelled;
    group.sessions += 1;
    groups.set(row.eventId, group);
  }

  const hint = (g: { tickets: number; paid: number; expired: number; cancelled: number; sessions: number }) =>
    `${formatNumber(g.tickets)} vé · ${formatNumber(g.paid)} đơn đã trả · ${formatNumber(g.expired)} hết hạn · ${formatNumber(g.cancelled)} huỷ · ${formatNumber(g.sessions)} suất`;

  const sorted = [...groups.entries()].filter(([, g]) => g.gross > 0).sort((a, b) => b[1].gross - a[1].gross);
  const shown = sorted.slice(0, MAX_BARS).map(([eventId, g]) => ({
    key: eventId,
    label: titleOf(eventId) ?? `Sự kiện ${eventId.slice(0, 8)}`,
    value: g.gross,
    hint: hint(g),
  }));

  const rest = sorted.slice(MAX_BARS);
  if (rest.length > 0) {
    const other = rest.reduce(
      (sum, [, g]) => ({
        gross: sum.gross + g.gross,
        tickets: sum.tickets + g.tickets,
        paid: sum.paid + g.paid,
        expired: sum.expired + g.expired,
        cancelled: sum.cancelled + g.cancelled,
        sessions: sum.sessions + g.sessions,
      }),
      { gross: 0, tickets: 0, paid: 0, expired: 0, cancelled: 0, sessions: 0 },
    );
    shown.push({ key: '__other__', label: `Khác (${rest.length} sự kiện)`, value: other.gross, hint: hint(other) });
  }
  return shown;
}

function formatMoneyShort(value: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(value)} ₫`;
}
