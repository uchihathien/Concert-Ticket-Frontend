'use client';

import {
  useInventoryStock,
  useOrderBuyers,
  useSalesBreakdown,
  useSalesDistribution,
  useSalesSeries,
  useSalesSummary,
  useStatsOrders,
  type OrganizationSummary,
  type StatsOrderRow,
  type StatsOrderStatus,
  type TicketTypeStock,
} from '@nexaticket/ts-sdk';
import {
  Badge,
  Button,
  ErrorState,
  FilterBar,
  Input,
  PageHeader,
  Pagination,
  Panel,
  Section,
  Select,
  Skeleton,
  Table,
  csvFilename,
  downloadCsv,
  formatDateTime,
  formatNumber,
  toCsv,
  useDebouncedValue,
  type BadgeTone,
} from '@nexaticket/ui';
import { Download, Gauge, Hourglass, PackageOpen, Ticket } from 'lucide-react';
import { Suspense, useMemo, useState } from 'react';
import { OrganizationGate } from '@/components/OrganizationGate';
import { KpiCard, ProgressBar } from '@/components/stats/KpiCard';
import { RatioBars } from '@/components/stats/SimpleCharts';
import { StatsFilterBar } from '@/components/stats/StatsFilterBar';
import { CountBarsChart } from '@/components/stats/lazy-charts';
import { fillBars, sessionText, startOf } from '@/components/stats/session-helpers';
import { useSessionDirectory } from '@/components/stats/useSessionDirectory';
import { METRIC_HELP } from '@/lib/stats-definitions';
import { addDays, todayInVietnam, useStatsFilters } from '@/lib/stats-filters';
import { bucketLabel, delta, fillTone, formatDay, formatMoney, formatPercent, ratio } from '@/lib/stats-math';
import { TicketLookup } from './ticket-lookup';

/**
 * A-TICKETS — vé đã bán.
 *
 * Ba câu hỏi, ba khối:
 * 1. **Bán được bao nhiêu, còn bao nhiêu** — thống kê theo loại vé và suất, theo bộ lọc chung.
 * 2. **Ai vừa mua** — danh sách đơn gần đây, có tìm kiếm và phân trang ở server.
 * 3. **Vé này của ai** — tra cứu từng vé (khối có sẵn từ trước, giữ nguyên).
 *
 * "Đã bán / còn lại" là tồn kho HIỆN TẠI (inventory-service); "bán trong kỳ" là đơn đã thanh toán
 * trong khoảng thời gian đang chọn (ordering-service). Bảng gọi tên từng cột theo đúng nghĩa đó.
 */
export default function TicketsPage() {
  return (
    <OrganizationGate title="Vé đã bán">
      {(organization) => (
        <Suspense
          fallback={
            <>
              <PageHeader title="Vé đã bán" description={organization.name} />
              <Panel>
                <Skeleton lines={4} />
              </Panel>
            </>
          }
        >
          <TicketsBody organization={organization} />
        </Suspense>
      )}
    </OrganizationGate>
  );
}

const TYPE_PAGE_SIZE = 10;
const VELOCITY_DAYS = 7;

function TicketsBody({ organization }: { organization: OrganizationSummary }) {
  const { filters, resolved, update, reset } = useStatsFilters();
  const [typePage, setTypePage] = useState(0);

  const summary = useSalesSummary(organization.id, resolved.params, resolved.compare);
  const series = useSalesSeries(organization.id, resolved.params, resolved.bucket, false);
  const breakdown = useSalesBreakdown(organization.id, resolved.params);
  const distribution = useSalesDistribution(organization.id, resolved.params);
  const stock = useInventoryStock(organization.id);
  const directory = useSessionDirectory(organization.id);

  // Tốc độ bán luôn là 7 ngày gần nhất, bất kể khoảng thời gian đang chọn: "đang bán nhanh hay
  // chậm" là câu hỏi về hiện tại, và một tốc độ tính trên "toàn thời gian" không trả lời nó.
  const today = todayInVietnam();
  const velocityParams = useMemo(
    () => ({ ...resolved.params, from: addDays(today, -(VELOCITY_DAYS - 1)), to: today }),
    [resolved.params, today],
  );
  const recent = useSalesSummary(organization.id, velocityParams, false);

  const stockRows = useMemo(
    () =>
      (stock.data?.ticketTypes ?? []).filter(
        (row) =>
          (filters.eventIds.length === 0 || filters.eventIds.includes(row.eventId)) &&
          (!filters.sessionId || row.eventSessionId === filters.sessionId) &&
          (!filters.ticketTypeId || row.ticketTypeId === filters.ticketTypeId),
      ),
    [stock.data, filters.eventIds, filters.sessionId, filters.ticketTypeId],
  );

  const soldInPeriod = useMemo(() => {
    const map = new Map<string, { tickets: number; gross: number }>();
    for (const row of breakdown.data?.ticketTypes ?? []) {
      map.set(`${row.eventSessionId}:${row.ticketTypeId}`, { tickets: row.ticketsSold, gross: row.grossVnd });
    }
    return map;
  }, [breakdown.data]);

  const typeRows = useMemo(
    () =>
      [...stockRows].sort(
        (a, b) =>
          startOf(directory.sessions, b.eventSessionId) - startOf(directory.sessions, a.eventSessionId) ||
          b.priceVnd - a.priceVnd,
      ),
    [stockRows, directory.sessions],
  );
  const typePageRows = typeRows.slice(typePage * TYPE_PAGE_SIZE, typePage * TYPE_PAGE_SIZE + TYPE_PAGE_SIZE);

  // Còn bán được: chỉ tính suất chưa diễn. Chỗ trống của một suất đã diễn xong không còn là hàng.
  const nowMs = Date.now();
  const upcoming = stockRows.filter((row) => startOf(directory.sessions, row.eventSessionId) > nowMs);
  const remaining = upcoming.reduce((total, row) => total + row.available, 0);
  const velocity = recent.data ? recent.data.current.ticketsSold / VELOCITY_DAYS : null;
  const sellOut = forecast(remaining, velocity, upcoming, directory.sessions);

  const movers = rankSellThrough(upcoming, directory.sessions);
  const now = summary.data?.current ?? null;
  const before = summary.data?.previous ?? null;
  const empty = now !== null && now.ordersTotal === 0;
  const compareLabel = summary.data?.previousPeriod
    ? `so với ${formatDay(summary.data.previousPeriod.from)} – ${formatDay(summary.data.previousPeriod.to)}`
    : undefined;

  const fillRows = fillBars(stockRows, directory.sessions, 8);
  const sizeRows = (distribution.data?.ticketsPerOrder ?? []).map((bucket) => ({
    key: String(bucket.tickets),
    label: `${bucket.tickets} vé`,
    title: `Đơn có ${bucket.tickets} vé`,
    value: bucket.orders,
  }));

  return (
    <>
      <PageHeader
        title="Vé đã bán"
        description={organization.name}
        actions={
          <Button
            variant="secondary"
            disabled={typeRows.length === 0}
            onClick={() =>
              downloadCsv(
                csvFilename(['ve-da-ban', resolved.params.from, resolved.params.to]),
                toCsv([
                  {
                    title: 'VÉ THEO LOẠI VÉ',
                    headers: ['Sự kiện · suất', 'Loại vé', 'Giá (VND)', 'Sức chứa', 'Đã bán', 'Đang giữ', 'Còn lại', 'Lấp đầy (%)', 'Vé bán trong kỳ', 'Doanh thu trong kỳ (VND)'],
                    rows: typeRows.map((row) => {
                      const period = soldInPeriod.get(`${row.eventSessionId}:${row.ticketTypeId}`);
                      const capacity = row.capacity - row.blocked;
                      return [
                        sessionText(directory.sessions, row.eventSessionId),
                        row.ticketTypeName,
                        row.priceVnd,
                        capacity,
                        row.sold,
                        row.held,
                        row.available,
                        capacity > 0 ? Math.round((row.sold / capacity) * 100) : '',
                        period?.tickets ?? 0,
                        period?.gross ?? 0,
                      ];
                    }),
                  },
                ]),
              )
            }
          >
            <Download size={16} aria-hidden="true" /> Xuất CSV
          </Button>
        }
      />

      <div className="grid gap-4">
        <StatsFilterBar
          organizationId={organization.id}
          filters={filters}
          resolved={resolved}
          onChange={(patch) => {
            update(patch);
            setTypePage(0);
          }}
          onReset={() => {
            reset();
            setTypePage(0);
          }}
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Vé bán trong kỳ"
            help={METRIC_HELP.ticketsSold}
            loading={summary.isPending}
            value={summary.isError || empty || !now ? null : formatNumber(now.ticketsSold)}
            delta={empty ? null : delta(now?.ticketsSold ?? null, before?.ticketsSold)}
            deltaLabel={compareLabel}
            hint={summary.isError ? 'Chưa hỏi được số liệu bán hàng' : empty ? 'Chưa có đơn nào trong kỳ' : undefined}
            icon={<Ticket />}
          />
          <KpiCard
            label="Còn bán được"
            help={METRIC_HELP.remaining}
            loading={stock.isPending || directory.loading}
            value={stock.isError ? null : formatNumber(remaining)}
            hint={
              stock.isError
                ? 'Chưa hỏi được tồn kho'
                : upcoming.length === 0
                  ? 'Không có suất nào sắp diễn'
                  : `ở ${formatNumber(new Set(upcoming.map((row) => row.eventSessionId)).size)} suất sắp diễn`
            }
            icon={<PackageOpen />}
          />
          <KpiCard
            label="Tốc độ bán"
            help={METRIC_HELP.velocity}
            loading={recent.isPending}
            value={
              velocity === null
                ? null
                : `${velocity.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} vé/ngày`
            }
            hint={`trung bình ${VELOCITY_DAYS} ngày gần nhất`}
            icon={<Gauge />}
          />
          <KpiCard
            label="Dự báo bán hết"
            help={METRIC_HELP.sellOut}
            loading={recent.isPending || stock.isPending || directory.loading}
            value={sellOut.value}
            hint={sellOut.hint}
            icon={<Hourglass />}
          />
        </div>

        <Section
          title="Theo loại vé"
          description="Sức chứa, đã bán, đang giữ, còn lại là tồn kho hiện tại. Hai cột cuối là số bán trong khoảng thời gian đang chọn."
        >
          {stock.isError ? (
            <ErrorState error={null} onRetry={() => void stock.refetch()} />
          ) : (
            <>
              <Table<TicketTypeStock>
                caption="Vé theo loại vé"
                rows={typePageRows}
                rowKey={(row) => `${row.eventSessionId}:${row.ticketTypeId}`}
                loading={stock.isPending}
                emptyTitle="Chưa có loại vé nào mở bán"
                emptyDescription="Loại vé xuất hiện ở đây sau khi sự kiện được công bố."
                columns={[
                  { key: 'session', header: 'Sự kiện · suất', cell: (row) => sessionText(directory.sessions, row.eventSessionId) },
                  { key: 'type', header: 'Loại vé', cell: (row) => row.ticketTypeName },
                  { key: 'price', header: 'Giá', numeric: true, cell: (row) => formatMoney(row.priceVnd) },
                  { key: 'capacity', header: 'Sức chứa', numeric: true, cell: (row) => formatNumber(row.capacity - row.blocked) },
                  { key: 'sold', header: 'Đã bán', numeric: true, cell: (row) => formatNumber(row.sold) },
                  { key: 'held', header: 'Đang giữ', numeric: true, cell: (row) => formatNumber(row.held) },
                  { key: 'left', header: 'Còn lại', numeric: true, cell: (row) => formatNumber(row.available) },
                  {
                    key: 'fill',
                    header: 'Lấp đầy',
                    width: '140px',
                    cell: (row) => {
                      const value = ratio(row.sold, row.capacity - row.blocked);
                      return (
                        <span className="grid min-w-[110px] grid-cols-[1fr_auto] items-center gap-2">
                          <ProgressBar value={value} label={`Lấp đầy ${row.ticketTypeName}`} />
                          <span className={`text-[12.5px] font-semibold tabular-nums ${FILL_TEXT[fillTone(value)]}`}>
                            {formatPercent(value)}
                          </span>
                        </span>
                      );
                    },
                  },
                  {
                    key: 'periodTickets',
                    header: 'Bán trong kỳ',
                    numeric: true,
                    cell: (row) => formatNumber(soldInPeriod.get(`${row.eventSessionId}:${row.ticketTypeId}`)?.tickets ?? 0),
                  },
                  {
                    key: 'periodGross',
                    header: 'Doanh thu trong kỳ',
                    numeric: true,
                    cell: (row) => formatMoney(soldInPeriod.get(`${row.eventSessionId}:${row.ticketTypeId}`)?.gross ?? 0),
                  },
                ]}
              />
              <Pagination
                page={typePage}
                received={typePageRows.length}
                pageSize={TYPE_PAGE_SIZE}
                onChange={setTypePage}
                label={`${formatNumber(typeRows.length)} loại vé · trang ${typePage + 1}`}
              />
            </>
          )}
        </Section>

        <div className="grid gap-4 xl:grid-cols-2">
          <Panel>
            {stock.isPending ? (
              <Skeleton lines={6} />
            ) : fillRows.length === 0 ? (
              <Empty title="Lấp đầy từng suất" text="Chưa có suất nào mở bán trong phạm vi bộ lọc." />
            ) : (
              <RatioBars caption="Lấp đầy từng suất" rows={fillRows} unit="chỗ" />
            )}
          </Panel>
          <Panel>
            <h2 className="m-0 mb-1 text-[14px] font-semibold">Loại vé bán nhanh nhất và chậm nhất</h2>
            <p className="m-0 mb-3 text-[12.5px] text-muted">
              Xếp theo tỉ lệ đã bán trên sức chứa, chỉ tính các suất sắp diễn.
            </p>
            {stock.isPending || directory.loading ? (
              <Skeleton lines={5} />
            ) : movers.fast.length === 0 ? (
              <p className="m-0 py-6 text-center text-[13px] text-muted">Không có suất nào sắp diễn trong phạm vi bộ lọc.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <MoverList title="Nhanh nhất" rows={movers.fast} />
                <MoverList title="Chậm nhất" rows={movers.slow} />
              </div>
            )}
          </Panel>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Panel>
            <h2 className="m-0 mb-3 text-[14px] font-semibold">Vé bán theo {BUCKET_NAME[resolved.bucket]}</h2>
            {series.isError ? (
              <ErrorState error={null} onRetry={() => void series.refetch()} />
            ) : series.isPending ? (
              <Skeleton lines={6} />
            ) : empty ? (
              <p className="m-0 py-8 text-center text-[13px] text-muted">Chưa có dữ liệu trong khoảng thời gian này.</p>
            ) : (
              <CountBarsChart
                caption="Vé bán theo thời gian"
                valueName="Vé đã bán"
                rows={series.data.current.map((point) => ({
                  key: point.bucket,
                  label: bucketLabel(point.bucket, series.data.bucket),
                  title: bucketLabel(point.bucket, series.data.bucket, true),
                  value: point.ticketsSold,
                }))}
              />
            )}
          </Panel>
          <Panel>
            <h2 className="m-0 mb-3 text-[14px] font-semibold">Số vé mỗi đơn</h2>
            {distribution.isPending ? (
              <Skeleton lines={6} />
            ) : sizeRows.length === 0 ? (
              <p className="m-0 py-8 text-center text-[13px] text-muted">Chưa có đơn đã thanh toán trong khoảng thời gian này.</p>
            ) : (
              <CountBarsChart caption="Phân bố số vé mỗi đơn" valueName="Số đơn" rows={sizeRows} />
            )}
          </Panel>
        </div>

        <Section title="Đơn gần đây" description="Đơn được tạo trong khoảng thời gian và bộ lọc đang chọn, mới nhất trước.">
          <RecentOrders organizationId={organization.id} params={resolved.params} sessions={directory.sessions} />
        </Section>

        <Section title="Tra cứu vé" description="Tìm một vé cụ thể theo mã vé, mã ghế hoặc tên khách. Khối này có bộ lọc riêng.">
          <TicketLookup organization={organization} />
        </Section>
      </div>
    </>
  );
}

const BUCKET_NAME = { hour: 'giờ', day: 'ngày', week: 'tuần' } as const;
const FILL_TEXT = { danger: 'text-danger-text', warn: 'text-warn-text', success: 'text-success-text', none: 'text-muted' } as const;

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <>
      <h2 className="m-0 mb-3 text-[14px] font-semibold">{title}</h2>
      <p className="m-0 py-8 text-center text-[13px] text-muted">{text}</p>
    </>
  );
}

type SessionMap = ReturnType<typeof useSessionDirectory>['sessions'];

/**
 * Ước tính ngày bán hết: số chỗ còn lại chia cho tốc độ 7 ngày gần nhất.
 *
 * Đây là phép chia thẳng, không phải mô hình — nó giả định tuần tới bán như tuần này. Nên kết quả
 * được nói là "khoảng", và khi ngày ước tính rơi SAU suất diễn cuối cùng thì nói thẳng là không kịp.
 */
function forecast(remaining: number, velocity: number | null, upcoming: TicketTypeStock[], sessions: SessionMap) {
  if (upcoming.length === 0) return { value: null, hint: 'Không có suất nào sắp diễn' };
  if (remaining === 0) return { value: 'Đã hết vé', hint: 'Mọi suất sắp diễn đã bán hết' };
  if (velocity === null) return { value: null, hint: undefined };
  if (velocity === 0) return { value: null, hint: `Chưa bán được vé nào trong ${VELOCITY_DAYS} ngày gần nhất` };

  const days = Math.ceil(remaining / velocity);
  const lastShow = Math.max(...upcoming.map((row) => startOf(sessions, row.eventSessionId)));
  const daysToLastShow = Math.ceil((lastShow - Date.now()) / 86_400_000);
  if (days > daysToLastShow) {
    return {
      value: 'Không kịp bán hết',
      hint: `Cần khoảng ${formatNumber(days)} ngày, còn ${formatNumber(daysToLastShow)} ngày tới suất cuối`,
    };
  }
  return {
    value: `Khoảng ${formatNumber(days)} ngày`,
    hint: `dự kiến hết vé quanh ${formatDay(addDays(todayInVietnam(), days))}, nếu giữ tốc độ hiện tại`,
  };
}

interface Mover {
  key: string;
  name: string;
  session: string;
  value: number | null;
  sold: number;
  capacity: number;
}

function rankSellThrough(rows: TicketTypeStock[], sessions: SessionMap): { fast: Mover[]; slow: Mover[] } {
  const ranked = rows
    .filter((row) => row.capacity - row.blocked > 0)
    .map((row) => ({
      key: `${row.eventSessionId}:${row.ticketTypeId}`,
      name: row.ticketTypeName,
      session: sessionText(sessions, row.eventSessionId),
      value: ratio(row.sold, row.capacity - row.blocked),
      sold: row.sold,
      capacity: row.capacity - row.blocked,
    }))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  // Ít hơn 6 loại vé thì hai danh sách sẽ trùng nhau; khi đó mỗi bên chỉ lấy nửa.
  const take = Math.min(3, Math.floor(ranked.length / 2) || ranked.length);
  return { fast: ranked.slice(0, take), slow: ranked.slice(-take).reverse() };
}

function MoverList({ title, rows }: { title: string; rows: Mover[] }) {
  return (
    <div>
      <h3 className="m-0 mb-2 text-[13px] font-semibold text-muted">{title}</h3>
      <ul className="m-0 grid list-none gap-2 p-0">
        {rows.map((row) => (
          <li key={row.key} className="grid gap-0.5 text-[13px]">
            <span className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate font-semibold" title={row.name}>
                {row.name}
              </span>
              <span className={`flex-none font-semibold tabular-nums ${FILL_TEXT[fillTone(row.value)]}`}>{formatPercent(row.value)}</span>
            </span>
            <span className="truncate text-[12px] text-muted" title={row.session}>
              {row.session} · {formatNumber(row.sold)}/{formatNumber(row.capacity)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const ORDER_PAGE_SIZE = 20;

const ORDER_STATUS: Record<StatsOrderStatus, { label: string; tone: BadgeTone }> = {
  PAID: { label: 'Đã thanh toán', tone: 'success' },
  AWAITING_PAYMENT: { label: 'Chờ thanh toán', tone: 'warn' },
  EXPIRED: { label: 'Quá hạn', tone: 'neutral' },
  CANCELLED: { label: 'Đã huỷ', tone: 'danger' },
  REFUNDED: { label: 'Đã hoàn tiền', tone: 'danger' },
  MANUAL_REVIEW: { label: 'Đang đối soát', tone: 'warn' },
};

/**
 * Danh sách đơn, tìm kiếm và phân trang ở server.
 *
 * Tên người mua đến từ một request riêng sang ticketing-service, đã che bớt ở server ("Nguyễn V. A.")
 * và chỉ hỏi cho đúng các đơn của trang đang xem. Đơn chưa thanh toán chưa có vé nên chưa có tên.
 */
function RecentOrders({
  organizationId,
  params,
  sessions,
}: {
  organizationId: string;
  params: { from: string; to: string; eventIds?: string[]; sessionIds?: string[]; ticketTypeIds?: string[] };
  sessions: SessionMap;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const debounced = useDebouncedValue(query, 350);

  // Bộ lọc chung đổi thì trang 4 của kết quả cũ không còn nghĩa. So trong lúc render (không qua
  // effect) để lượt gọi đầu tiên đã mang trang 0.
  const scope = JSON.stringify(params);
  const [seenScope, setSeenScope] = useState(scope);
  if (seenScope !== scope) {
    setSeenScope(scope);
    setPage(0);
  }

  const listParams = useMemo(
    () => ({
      ...params,
      statuses: status ? [status as StatsOrderStatus] : undefined,
      query: debounced.trim() || undefined,
      page,
      size: ORDER_PAGE_SIZE,
    }),
    [params, status, debounced, page],
  );
  const orders = useStatsOrders(organizationId, listParams);
  const rows = useMemo(() => orders.data?.rows ?? [], [orders.data]);
  const paidIds = useMemo(() => rows.filter((row) => row.paidAt !== null).map((row) => row.orderId), [rows]);
  const buyers = useOrderBuyers(organizationId, paidIds);
  const nameOf = useMemo(
    () => new Map((buyers.data?.buyers ?? []).map((buyer) => [buyer.orderId, buyer.name])),
    [buyers.data],
  );

  return (
    <>
      <FilterBar
        count={
          orders.isPending
            ? 'Đang tìm…'
            : `${formatNumber(orders.data?.total ?? 0)} đơn khớp bộ lọc`
        }
      >
        <Input
          label="Tìm theo mã đơn"
          placeholder="Ví dụ NT-261006"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(0);
          }}
        />
        <Select
          label="Trạng thái đơn"
          value={status}
          options={[
            { value: '', label: 'Mọi trạng thái' },
            { value: 'PAID', label: 'Đã thanh toán' },
            { value: 'AWAITING_PAYMENT', label: 'Chờ thanh toán' },
            { value: 'EXPIRED', label: 'Quá hạn' },
            { value: 'CANCELLED', label: 'Đã huỷ' },
          ]}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(0);
          }}
        />
      </FilterBar>

      {orders.isError ? (
        <ErrorState error={null} onRetry={() => void orders.refetch()} />
      ) : (
        <div className={orders.isPlaceholderData ? 'opacity-60' : undefined}>
          <Table<StatsOrderRow>
            caption="Đơn gần đây"
            rows={rows}
            rowKey={(row) => row.orderId}
            loading={orders.isPending}
            emptyTitle="Không có đơn nào khớp"
            emptyDescription="Thử bỏ bớt bộ lọc hoặc mở rộng khoảng thời gian."
            columns={[
              { key: 'number', header: 'Mã đơn', cell: (row) => <code>{row.orderNumber}</code> },
              {
                key: 'buyer',
                header: 'Người mua',
                // Dấu gạch cho đơn chưa có vé (chưa thanh toán) — ô trống đọc như bảng chưa tải xong.
                cell: (row) => nameOf.get(row.orderId) ?? '—',
              },
              { key: 'session', header: 'Sự kiện · suất', cell: (row) => sessionText(sessions, row.eventSessionId) },
              { key: 'tickets', header: 'Số vé', numeric: true, cell: (row) => formatNumber(row.tickets) },
              { key: 'total', header: 'Số tiền', numeric: true, cell: (row) => formatMoney(row.totalVnd) },
              {
                key: 'status',
                header: 'Trạng thái',
                cell: (row) => <Badge tone={ORDER_STATUS[row.status].tone}>{ORDER_STATUS[row.status].label}</Badge>,
              },
              { key: 'created', header: 'Thời điểm', cell: (row) => formatDateTime(row.createdAt) },
            ]}
          />
          <Pagination
            page={page}
            received={rows.length}
            pageSize={ORDER_PAGE_SIZE}
            onChange={setPage}
            label={`Trang ${page + 1} / ${Math.max(1, Math.ceil((orders.data?.total ?? 0) / ORDER_PAGE_SIZE))}`}
          />
        </div>
      )}
    </>
  );
}
