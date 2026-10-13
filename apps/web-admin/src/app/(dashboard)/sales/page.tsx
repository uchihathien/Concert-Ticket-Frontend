'use client';

import {
  ApiError,
  useOrganizationDashboard,
  useSalesBreakdown,
  useSalesHeatmap,
  useSalesSeries,
  useSalesSummary,
  type OrganizationSummary,
  type SalesSessionRow,
  type SalesTotals,
} from '@nexaticket/ts-sdk';
import {
  BarChart,
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  Panel,
  Section,
  Skeleton,
  Table,
  csvFilename,
  downloadCsv,
  formatDateTime,
  formatNumber,
  toCsv,
} from '@nexaticket/ui';
import { Banknote, Download, ReceiptText, ShoppingCart, Ticket } from 'lucide-react';
import { Suspense, useMemo, useState } from 'react';
import { OrganizationGate } from '@/components/OrganizationGate';
import { KpiCard } from '@/components/stats/KpiCard';
import { Heatmap } from '@/components/stats/SimpleCharts';
import { StatsFilterBar } from '@/components/stats/StatsFilterBar';
import { RevenueTrendChart, StackedBarsChart } from '@/components/stats/lazy-charts';
import { useSessionDirectory } from '@/components/stats/useSessionDirectory';
import { METRIC_HELP } from '@/lib/stats-definitions';
import { useStatsFilters } from '@/lib/stats-filters';
import { delta, formatDay, formatDurationShort, formatMoney, formatPercent, ratio } from '@/lib/stats-math';

/**
 * A-SALES — doanh thu của tổ chức.
 *
 * <h3>Một nguồn, một định nghĩa</h3>
 *
 * Mọi con số ở đây đến từ ordering-service: đơn thuộc về kỳ theo thời điểm đặt, và doanh thu là
 * tổng tiền các đơn đã thanh toán. Thẻ, biểu đồ và bảng cùng đọc một bộ lọc, nên tổng của bảng luôn
 * bằng con số trên thẻ.
 *
 * <h3>Không có tài chính</h3>
 *
 * Không hoa hồng, không phí, không "thực nhận", không lịch chi trả — đó là ranh giới cứng giữa miền
 * của ban tổ chức và miền tài chính của nền tảng (ADR-1010).
 */
export default function SalesPage() {
  return (
    <OrganizationGate title="Doanh thu">
      {(organization) => (
        // `useSearchParams` cần một ranh giới Suspense, nếu không Next từ chối dựng trang tĩnh.
        <Suspense fallback={<PageSkeleton organization={organization} />}>
          <SalesBody organization={organization} />
        </Suspense>
      )}
    </OrganizationGate>
  );
}

function PageSkeleton({ organization }: { organization: OrganizationSummary }) {
  return (
    <>
      <PageHeader title="Doanh thu" description={organization.name} />
      <Panel>
        <Skeleton lines={4} />
      </Panel>
    </>
  );
}

const MAX_STACK_COLUMNS = 8;
const MAX_STACK_LAYERS = 6;
const OTHER = 'Loại khác';

function SalesBody({ organization }: { organization: OrganizationSummary }) {
  const { filters, resolved, update, reset } = useStatsFilters();
  const [cumulative, setCumulative] = useState(false);

  const summary = useSalesSummary(organization.id, resolved.params, resolved.compare);
  const series = useSalesSeries(organization.id, resolved.params, resolved.bucket, resolved.compare);
  const breakdown = useSalesBreakdown(organization.id, resolved.params);
  const heatmap = useSalesHeatmap(organization.id, resolved.params);
  const dashboard = useOrganizationDashboard(organization.id);

  const titleOf = useMemo(
    () => new Map((dashboard.data?.events ?? []).map((event) => [event.id, event.title])),
    [dashboard.data],
  );
  const sessionRows = useMemo(() => breakdown.data?.sessions ?? [], [breakdown.data]);
  const directory = useSessionDirectory(organization.id);

  const eventName = (eventId: string) => titleOf.get(eventId) ?? `Sự kiện ${eventId.slice(0, 8)}`;
  const sessionTime = (sessionId: string) => {
    const info = directory.sessions.get(sessionId);
    return info ? formatDateTime(info.startsAt) : `Suất ${sessionId.slice(0, 8)}`;
  };

  const byEvent = useMemo(() => {
    const groups = new Map<string, { gross: number; tickets: number; total: number; paid: number; expired: number; cancelled: number }>();
    for (const row of sessionRows) {
      const group = groups.get(row.eventId) ?? { gross: 0, tickets: 0, total: 0, paid: 0, expired: 0, cancelled: 0 };
      group.gross += row.grossVnd;
      group.tickets += row.ticketsSold;
      group.total += row.ordersTotal;
      group.paid += row.ordersPaid;
      group.expired += row.ordersExpired;
      group.cancelled += row.ordersCancelled;
      groups.set(row.eventId, group);
    }
    return [...groups.entries()].map(([eventId, group]) => ({ eventId, ...group }));
  }, [sessionRows]);

  if (summary.isError) {
    return (
      <>
        <PageHeader title="Doanh thu" description={organization.name} />
        <StatsFilterBar organizationId={organization.id} filters={filters} resolved={resolved} onChange={update} onReset={reset} />
        <StatsError error={summary.error} onRetry={() => void summary.refetch()} />
      </>
    );
  }

  const now = summary.data?.current ?? null;
  const before = summary.data?.previous ?? null;
  const loading = summary.isPending;
  const empty = now !== null && now.ordersTotal === 0;
  const compareLabel = summary.data?.previousPeriod
    ? `so với ${formatDay(summary.data.previousPeriod.from)} – ${formatDay(summary.data.previousPeriod.to)}`
    : undefined;
  const totalGross = now?.grossVnd ?? 0;

  const eventBars = [...byEvent]
    .filter((group) => group.gross > 0)
    .sort((a, b) => b.gross - a.gross)
    .slice(0, 10)
    .map((group) => ({
      key: group.eventId,
      label: eventName(group.eventId),
      value: group.gross,
      // Chú giải mang đủ bốn thứ: tên đầy đủ (nhãn có thể bị cắt), số vé, doanh thu, phần trăm.
      hint: `${eventName(group.eventId)} — ${formatNumber(group.tickets)} vé · ${formatMoney(group.gross)} · ${formatPercent(ratio(group.gross, totalGross), 1)} tổng doanh thu`,
    }));

  const stacked = buildStack(breakdown.data?.ticketTypes ?? [], sessionRows, eventName, sessionTime);

  return (
    <>
      <PageHeader
        title="Doanh thu"
        description={organization.name}
        actions={
          <Button
            variant="secondary"
            disabled={sessionRows.length === 0}
            onClick={() =>
              downloadCsv(
                csvFilename(['doanh-thu', resolved.params.from, resolved.params.to]),
                toCsv(buildCsv(organization, resolved.params.from, resolved.params.to, sessionRows, eventName, sessionTime)),
              )
            }
          >
            <Download size={16} aria-hidden="true" /> Xuất CSV
          </Button>
        }
      />

      <div className="grid gap-4">
        <StatsFilterBar organizationId={organization.id} filters={filters} resolved={resolved} onChange={update} onReset={reset} />

        <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-4 ${summary.isPlaceholderData ? 'opacity-60' : ''}`}>
          <KpiCard
            label="Doanh thu"
            help={METRIC_HELP.revenue}
            loading={loading}
            value={empty || !now ? null : formatMoney(now.grossVnd)}
            delta={empty ? null : delta(now?.grossVnd ?? null, before?.grossVnd)}
            deltaLabel={compareLabel}
            icon={<Banknote />}
          />
          <KpiCard
            label="Vé đã bán"
            help={METRIC_HELP.ticketsSold}
            loading={loading}
            value={empty || !now ? null : formatNumber(now.ticketsSold)}
            delta={empty ? null : delta(now?.ticketsSold ?? null, before?.ticketsSold)}
            deltaLabel={compareLabel}
            icon={<Ticket />}
          />
          <KpiCard
            label="Đơn đã thanh toán"
            help={METRIC_HELP.ordersPaid}
            loading={loading}
            value={empty || !now ? null : formatNumber(now.ordersPaid)}
            delta={empty ? null : delta(now?.ordersPaid ?? null, before?.ordersPaid)}
            deltaLabel={compareLabel}
            hint={now && !empty ? `trên ${formatNumber(now.ordersTotal)} đơn được tạo` : undefined}
            icon={<ReceiptText />}
          />
          <KpiCard
            label="Giá trị đơn trung bình"
            help={METRIC_HELP.averageOrderValue}
            loading={loading}
            value={now && now.ordersPaid > 0 ? formatMoney(now.grossVnd / now.ordersPaid) : null}
            delta={delta(averageOrder(now), averageOrder(before))}
            deltaLabel={compareLabel}
            icon={<ShoppingCart />}
          />
        </div>

        {empty ? (
          <EmptyState
            title="Chưa có dữ liệu trong khoảng thời gian này"
            description="Không có đơn hàng nào được tạo với bộ lọc hiện tại. Thử mở rộng khoảng thời gian hoặc bỏ bớt bộ lọc."
          />
        ) : (
          <>
            <Panel>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="m-0 text-[15px] font-semibold">
                  {cumulative ? 'Doanh thu lũy kế' : 'Doanh thu'} theo {BUCKET_NAME[resolved.bucket]}
                  {resolved.compare ? <span className="font-normal text-muted"> · nét đứt là kỳ trước</span> : null}
                </h2>
                <div className="flex gap-1" role="group" aria-label="Kiểu biểu đồ">
                  <ToggleButton active={!cumulative} onClick={() => setCumulative(false)}>
                    Từng {BUCKET_NAME[resolved.bucket]}
                  </ToggleButton>
                  <ToggleButton active={cumulative} onClick={() => setCumulative(true)}>
                    Lũy kế
                  </ToggleButton>
                </div>
              </div>
              {series.isError ? (
                <ErrorState error={null} onRetry={() => void series.refetch()} />
              ) : series.isPending ? (
                <Skeleton lines={6} />
              ) : (
                <div className={series.isPlaceholderData ? 'opacity-60' : undefined}>
                  <RevenueTrendChart
                    points={series.data.current}
                    previous={series.data.previous}
                    bucket={series.data.bucket}
                    cumulative={cumulative}
                  />
                </div>
              )}
            </Panel>

            <div className="grid gap-4 xl:grid-cols-2">
              <Panel>
                {breakdown.isPending ? (
                  <Skeleton lines={6} />
                ) : eventBars.length === 0 ? (
                  <ChartEmpty title="Doanh thu theo sự kiện" />
                ) : (
                  <BarChart
                    caption={byEvent.length > eventBars.length ? `Doanh thu theo sự kiện · ${eventBars.length} sự kiện dẫn đầu` : 'Doanh thu theo sự kiện'}
                    rows={eventBars}
                    format={formatMoney}
                  />
                )}
              </Panel>
              <Panel>
                <h2 className="m-0 mb-3 text-[15px] font-semibold">
                  Doanh thu theo suất và loại vé
                  {stacked.truncated ? <span className="font-normal text-muted"> · {MAX_STACK_COLUMNS} suất dẫn đầu</span> : null}
                </h2>
                {breakdown.isPending ? (
                  <Skeleton lines={6} />
                ) : stacked.columns.length === 0 ? (
                  <ChartEmpty />
                ) : (
                  <StackedBarsChart columns={stacked.columns} layers={stacked.layers} caption="Doanh thu theo suất và loại vé" />
                )}
              </Panel>
            </div>

            <Panel>
              <h2 className="m-0 mb-1 text-[15px] font-semibold">Thời điểm khách mua</h2>
              <p className="m-0 mb-3 text-[13px] text-muted">
                Doanh thu theo thứ trong tuần và giờ trong ngày (giờ Việt Nam). Ô càng đậm, doanh thu càng cao.
              </p>
              {heatmap.isPending ? (
                <Skeleton lines={5} />
              ) : heatmap.isError ? (
                <ErrorState error={null} onRetry={() => void heatmap.refetch()} />
              ) : heatmap.data.cells.length === 0 ? (
                <ChartEmpty />
              ) : (
                <Heatmap cells={heatmap.data.cells} />
              )}
            </Panel>

            <Section title="Đơn hàng và thanh toán" description="Từ lúc tạo đơn tới lúc tiền về.">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <Panel>{now ? <Funnel totals={now} /> : <Skeleton lines={5} />}</Panel>
                <Panel>
                  <Table
                    caption="Tỉ lệ bỏ giỏ theo sự kiện"
                    rows={[...byEvent].filter((group) => group.total > 0).sort((a, b) => abandon(b) - abandon(a)).slice(0, 8)}
                    rowKey={(row) => row.eventId}
                    loading={breakdown.isPending}
                    emptyTitle="Chưa có đơn nào"
                    columns={[
                      { key: 'event', header: 'Sự kiện', cell: (row) => eventName(row.eventId) },
                      { key: 'total', header: 'Đơn tạo', numeric: true, cell: (row) => formatNumber(row.total) },
                      { key: 'paid', header: 'Đã trả', numeric: true, cell: (row) => formatNumber(row.paid) },
                      {
                        key: 'lost',
                        header: 'Quá hạn / huỷ',
                        numeric: true,
                        cell: (row) => `${formatNumber(row.expired)} / ${formatNumber(row.cancelled)}`,
                      },
                      {
                        key: 'rate',
                        header: 'Bỏ giỏ',
                        numeric: true,
                        cell: (row) => formatPercent(ratio(row.expired + row.cancelled, row.total), 1),
                      },
                    ]}
                  />
                </Panel>
              </div>
            </Section>

            <Section title="Chi tiết theo suất diễn" description="Tổng của bảng bằng đúng các thẻ ở đầu trang.">
              <DetailTable
                rows={sessionRows}
                loading={breakdown.isPending}
                eventName={eventName}
                sessionTime={sessionTime}
              />
            </Section>
          </>
        )}
      </div>
    </>
  );
}

const BUCKET_NAME = { hour: 'giờ', day: 'ngày', week: 'tuần' } as const;

function averageOrder(totals: SalesTotals | null): number | null {
  return totals && totals.ordersPaid > 0 ? totals.grossVnd / totals.ordersPaid : null;
}

function abandon(group: { expired: number; cancelled: number; total: number }): number {
  return group.total > 0 ? (group.expired + group.cancelled) / group.total : 0;
}

function ToggleButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-nt border px-2.5 py-1 text-[13px] font-semibold ${
        active ? 'border-primary bg-accent text-primary-text' : 'border-border bg-transparent text-muted hover:bg-hover'
      }`}
    >
      {children}
    </button>
  );
}

function ChartEmpty({ title }: { title?: string }) {
  return (
    <>
      {title ? <h2 className="m-0 mb-3 text-[15px] font-semibold">{title}</h2> : null}
      <p className="m-0 py-8 text-center text-[13px] text-muted">Chưa có đơn đã thanh toán trong phạm vi bộ lọc này.</p>
    </>
  );
}

/**
 * Phễu đơn hàng: mọi đơn được tạo trong kỳ rơi vào đúng một nhánh.
 *
 * Bốn nhánh cộng lại bằng số đơn tạo (cộng thêm "khác" nếu có đơn đang đối soát tay), nên người đọc
 * tự kiểm được rằng không đơn nào bị bỏ sót.
 */
function Funnel({ totals }: { totals: SalesTotals }) {
  const steps = [
    { label: 'Đã thanh toán', value: totals.ordersPaid, tone: 'bg-success' },
    { label: 'Đang chờ thanh toán', value: totals.ordersAwaiting, tone: 'bg-warn' },
    { label: 'Quá hạn', value: totals.ordersExpired, tone: 'bg-danger' },
    { label: 'Đã huỷ', value: totals.ordersCancelled, tone: 'bg-danger' },
    ...(totals.ordersOther > 0 ? [{ label: 'Khác (đang đối soát)', value: totals.ordersOther, tone: 'bg-border' }] : []),
  ];
  return (
    <div className="grid gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="m-0 text-[15px] font-semibold">Phễu đơn hàng</h3>
        <span className="text-[13px] text-muted tabular-nums">{formatNumber(totals.ordersTotal)} đơn được tạo</span>
      </div>
      <ul className="m-0 grid list-none gap-2.5 p-0">
        {steps.map((step) => {
          const share = ratio(step.value, totals.ordersTotal);
          return (
            <li key={step.label} className="grid gap-1">
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span>{step.label}</span>
                <span className="tabular-nums text-muted">
                  {formatNumber(step.value)} · <strong className="font-semibold text-ink">{formatPercent(share, 1)}</strong>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-bg-subtle">
                <div className={`h-full rounded-full ${step.tone}`} style={{ width: `${(share ?? 0) * 100}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      <dl className="m-0 grid grid-cols-2 gap-3 border-t border-border pt-3 text-[13px]">
        <div>
          <dt className="text-muted" title={METRIC_HELP.abandonRate}>
            Tỉ lệ bỏ giỏ
          </dt>
          <dd className="m-0 text-[18px] font-bold tabular-nums">
            {formatPercent(ratio(totals.ordersExpired + totals.ordersCancelled, totals.ordersTotal), 1)}
          </dd>
        </div>
        <div>
          <dt className="text-muted" title={METRIC_HELP.timeToPay}>
            Thời gian tới lúc thanh toán
          </dt>
          <dd className="m-0 text-[18px] font-bold tabular-nums">{formatDurationShort(totals.avgSecondsToPay)}</dd>
        </div>
      </dl>
    </div>
  );
}

type DetailRow = SalesSessionRow & { total?: boolean };

function DetailTable({
  rows,
  loading,
  eventName,
  sessionTime,
}: {
  rows: SalesSessionRow[];
  loading: boolean;
  eventName: (eventId: string) => string;
  sessionTime: (sessionId: string) => string;
}) {
  // Dòng tổng là một dòng của chính bảng (không phải một khối riêng bên dưới) để các cột số thẳng
  // hàng với nhau, và để người đọc cộng nhẩm được ngay tại chỗ.
  const withTotal: DetailRow[] = rows.length === 0 ? [] : [...rows, { ...sumRows(rows), total: true }];
  const strong = (row: DetailRow, text: string) => (row.total ? <strong>{text}</strong> : text);

  return (
    <Table<DetailRow>
      caption="Doanh thu theo suất diễn"
      rows={withTotal}
      rowKey={(row) => (row.total ? '__total__' : row.eventSessionId)}
      loading={loading}
      emptyTitle="Chưa có đơn nào trong phạm vi bộ lọc"
      columns={[
        { key: 'event', header: 'Sự kiện', cell: (row) => (row.total ? <strong>Tổng cộng</strong> : eventName(row.eventId)) },
        { key: 'session', header: 'Suất', cell: (row) => (row.total ? '' : sessionTime(row.eventSessionId)) },
        { key: 'tickets', header: 'Vé bán', numeric: true, cell: (row) => strong(row, formatNumber(row.ticketsSold)) },
        { key: 'gross', header: 'Doanh thu', numeric: true, cell: (row) => strong(row, formatMoney(row.grossVnd)) },
        { key: 'paid', header: 'Đơn đã trả', numeric: true, cell: (row) => strong(row, formatNumber(row.ordersPaid)) },
        {
          key: 'lost',
          header: 'Quá hạn / huỷ',
          numeric: true,
          cell: (row) => strong(row, `${formatNumber(row.ordersExpired)} / ${formatNumber(row.ordersCancelled)}`),
        },
        {
          key: 'aov',
          header: 'Giá trị đơn TB',
          numeric: true,
          cell: (row) => strong(row, row.ordersPaid > 0 ? formatMoney(row.grossVnd / row.ordersPaid) : '—'),
        },
      ]}
    />
  );
}

function sumRows(rows: SalesSessionRow[]): SalesSessionRow {
  return rows.reduce(
    (sum, row) => ({
      ...sum,
      ticketsSold: sum.ticketsSold + row.ticketsSold,
      grossVnd: sum.grossVnd + row.grossVnd,
      ordersTotal: sum.ordersTotal + row.ordersTotal,
      ordersPaid: sum.ordersPaid + row.ordersPaid,
      ordersAwaiting: sum.ordersAwaiting + row.ordersAwaiting,
      ordersExpired: sum.ordersExpired + row.ordersExpired,
      ordersCancelled: sum.ordersCancelled + row.ordersCancelled,
    }),
    { eventId: '', eventSessionId: '', ticketsSold: 0, grossVnd: 0, ordersTotal: 0, ordersPaid: 0, ordersAwaiting: 0, ordersExpired: 0, ordersCancelled: 0 },
  );
}

function buildStack(
  ticketTypes: { eventId: string; eventSessionId: string; ticketTypeName: string; grossVnd: number }[],
  sessions: SalesSessionRow[],
  eventName: (eventId: string) => string,
  sessionTime: (sessionId: string) => string,
) {
  const top = [...sessions].filter((row) => row.grossVnd > 0).sort((a, b) => b.grossVnd - a.grossVnd).slice(0, MAX_STACK_COLUMNS);
  const shown = new Set(top.map((row) => row.eventSessionId));
  const relevant = ticketTypes.filter((row) => shown.has(row.eventSessionId));

  // Lớp gom theo TÊN loại vé: "VIP" của hai suất là cùng một màu, dù mã khác nhau.
  const byName = new Map<string, number>();
  for (const row of relevant) byName.set(row.ticketTypeName, (byName.get(row.ticketTypeName) ?? 0) + row.grossVnd);
  const ranked = [...byName.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  const kept = new Set(ranked.slice(0, MAX_STACK_LAYERS));
  const layers = ranked.length > MAX_STACK_LAYERS ? [...ranked.slice(0, MAX_STACK_LAYERS), OTHER] : ranked;

  const columns = top.map((session) => {
    const values: Record<string, number> = {};
    for (const row of relevant) {
      if (row.eventSessionId !== session.eventSessionId) continue;
      const layer = kept.has(row.ticketTypeName) ? row.ticketTypeName : OTHER;
      values[layer] = (values[layer] ?? 0) + row.grossVnd;
    }
    const name = eventName(session.eventId);
    return {
      key: session.eventSessionId,
      label: name.length > 14 ? `${name.slice(0, 13)}…` : name,
      title: `${name} · ${sessionTime(session.eventSessionId)}`,
      values,
    };
  });
  return { columns, layers, truncated: sessions.filter((row) => row.grossVnd > 0).length > top.length };
}

function buildCsv(
  organization: OrganizationSummary,
  from: string,
  to: string,
  rows: SalesSessionRow[],
  eventName: (eventId: string) => string,
  sessionTime: (sessionId: string) => string,
) {
  const total = sumRows(rows);
  const line = (row: SalesSessionRow, event: string, session: string) => [
    event,
    session,
    row.ticketsSold,
    row.grossVnd,
    row.ordersPaid,
    row.ordersExpired,
    row.ordersCancelled,
    row.ordersPaid > 0 ? Math.round(row.grossVnd / row.ordersPaid) : '',
  ];
  return [
    {
      title: 'BÁO CÁO DOANH THU',
      headers: ['Mục', 'Giá trị'],
      rows: [
        ['Tổ chức', organization.name],
        ['Từ ngày', from],
        ['Đến ngày', to],
        ['Múi giờ', 'Asia/Ho_Chi_Minh'],
        ['Cách tính doanh thu', METRIC_HELP.revenue],
      ],
    },
    {
      title: 'THEO SUẤT DIỄN',
      headers: ['Sự kiện', 'Suất', 'Vé bán', 'Doanh thu (VND)', 'Đơn đã trả', 'Đơn quá hạn', 'Đơn huỷ', 'Giá trị đơn TB (VND)'],
      rows: [
        ...rows.map((row) => line(row, eventName(row.eventId), sessionTime(row.eventSessionId))),
        line(total, 'TỔNG CỘNG', ''),
      ],
    },
  ];
}

/**
 * Lỗi của trang thống kê, nói rõ phần nào là hạ tầng.
 *
 * 404 ở đây gần như chắc chắn là thiếu route ở api-gateway hoặc ordering-service chưa chạy bản mới —
 * không phải tổ chức chưa có doanh thu. Nói thẳng điều đó để người vận hành đi tìm đúng chỗ.
 */
function StatsError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const apiError = error instanceof ApiError ? error : null;
  if (apiError && apiError.status !== 404 && apiError.status < 500) {
    return <ErrorState error={apiError} correlationId={apiError.correlationId ?? null} onRetry={onRetry} />;
  }
  return (
    <Panel>
      <h2 className="m-0 mb-2 text-lg font-bold">Chưa lấy được số liệu thống kê</h2>
      <p className="m-0 mb-3 text-muted">
        Trang này đọc <code>/v1/organizations/…/stats/orders</code> của ordering-service qua api-gateway. Nếu vừa cập
        nhật mã nguồn, hãy khởi động lại backend để nạp endpoint và route mới.
      </p>
      <Button variant="secondary" onClick={onRetry}>
        Thử lại
      </Button>
      {apiError?.correlationId ? <p className="m-0 mt-3 text-[13px] text-muted">Mã tra cứu: {apiError.correlationId}</p> : null}
    </Panel>
  );
}
