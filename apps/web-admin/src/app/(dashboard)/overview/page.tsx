'use client';

import {
  useGatePresence,
  useInventoryStock,
  useOrganizationDashboard,
  useSalesSeries,
  useSalesSummary,
  type OrganizationSummary,
  type SalesTotals,
} from '@nexaticket/ts-sdk';
import { ErrorState, PageHeader, Panel, Section, Skeleton, formatDateTime, formatNumber } from '@nexaticket/ui';
import { Banknote, CalendarClock, DoorOpen, Hourglass, Percent, ReceiptText, ShoppingCart, Ticket, Users } from 'lucide-react';
import Link from 'next/link';
import { Suspense, useMemo } from 'react';
import { OrganizationGate } from '@/components/OrganizationGate';
import { KpiCard } from '@/components/stats/KpiCard';
import { RatioBars, type RatioRow } from '@/components/stats/SimpleCharts';
import { StatsFilterBar } from '@/components/stats/StatsFilterBar';
import { RevenueTrendChart } from '@/components/stats/lazy-charts';
import { fillBars, sessionLabel, startOf } from '@/components/stats/session-helpers';
import { useSessionDirectory } from '@/components/stats/useSessionDirectory';
import { METRIC_HELP } from '@/lib/stats-definitions';
import { useStatsFilters } from '@/lib/stats-filters';
import { delta, formatDay, formatMoney, formatPercent, ratio } from '@/lib/stats-math';
import { EventExplorer } from './event-explorer';

/**
 * A-OVERVIEW — bảng điều khiển của ban tổ chức.
 *
 * <h3>Hai loại con số, và trang nói rõ loại nào là loại nào</h3>
 *
 * - **Theo kỳ** (doanh thu, vé bán, đơn, tỉ lệ thanh toán): đổi theo khoảng thời gian đang chọn và có
 *   mũi tên so với kỳ trước. Nguồn: ordering-service.
 * - **Hiện tại** (lấp đầy, đang giữ chỗ, tỉ lệ đến): là trạng thái lúc mở trang. Chúng theo bộ lọc
 *   sự kiện và suất, nhưng KHÔNG theo khoảng thời gian — "đang giữ chỗ tuần trước" không có nghĩa.
 *   Nguồn: inventory-service và ticketing-service.
 *
 * Trộn hai loại vào một hàng thẻ không nhãn là cách chắc chắn để ban tổ chức so một con số 7 ngày
 * với một con số từ trước tới nay.
 */
export default function OverviewPage() {
  return (
    <OrganizationGate title="Tổng quan">
      {(organization) => (
        <Suspense
          fallback={
            <>
              <PageHeader title="Tổng quan" description={organization.name} />
              <Panel>
                <Skeleton lines={4} />
              </Panel>
            </>
          }
        >
          <OverviewBody organization={organization} />
        </Suspense>
      )}
    </OrganizationGate>
  );
}

const MAX_SESSION_BARS = 8;

function OverviewBody({ organization }: { organization: OrganizationSummary }) {
  const { filters, resolved, update, reset, queryString } = useStatsFilters();

  const summary = useSalesSummary(organization.id, resolved.params, resolved.compare);
  const series = useSalesSeries(organization.id, resolved.params, resolved.bucket, resolved.compare);
  const stock = useInventoryStock(organization.id);
  const presence = useGatePresence(organization.id);
  const dashboard = useOrganizationDashboard(organization.id);

  // Số liệu "hiện tại" về cả tổ chức trong một lượt; lọc theo sự kiện, suất, loại vé ở đây.
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
  const sessionEvent = useMemo(
    () => new Map((stock.data?.ticketTypes ?? []).map((row) => [row.eventSessionId, row.eventId])),
    [stock.data],
  );
  const inScope = useMemo(() => new Set(stockRows.map((row) => row.eventSessionId)), [stockRows]);

  const directory = useSessionDirectory(organization.id);

  const capacity = sum(stockRows, (row) => row.capacity - row.blocked);
  const sold = sum(stockRows, (row) => row.sold);
  const held = sum(stockRows, (row) => row.held);
  const expiring = sum(
    (stock.data?.expiringHolds ?? []).filter((row) => inScope.has(row.eventSessionId)),
    (row) => row.seats,
  );

  // Hiện diện không mang mã sự kiện; nối qua suất của tồn kho. Loại vé không áp dụng ở đây.
  const presenceRows = useMemo(
    () =>
      (presence.data?.sessions ?? []).filter((row) => {
        const eventId = sessionEvent.get(row.eventSessionId);
        return (
          (filters.eventIds.length === 0 || (eventId !== undefined && filters.eventIds.includes(eventId))) &&
          (!filters.sessionId || row.eventSessionId === filters.sessionId)
        );
      }),
    [presence.data, sessionEvent, filters.eventIds, filters.sessionId],
  );
  // Tỉ lệ đến chỉ tính trên những suất ĐÃ có người vào: gộp cả suất tháng sau vào mẫu số sẽ kéo tỉ
  // lệ về gần 0 và không nói lên điều gì.
  const opened = presenceRows.filter((row) => row.arrived > 0);
  const arrived = sum(opened, (row) => row.arrived);
  const issued = sum(opened, (row) => row.ticketsIssued);

  const nextShow = useMemo(() => {
    const now = Date.now();
    const upcoming = (dashboard.data?.events ?? [])
      .filter((event) => filters.eventIds.length === 0 || filters.eventIds.includes(event.id))
      .flatMap((event) => (event.nextSessionAt && Date.parse(event.nextSessionAt) > now ? [event] : []))
      .sort((a, b) => Date.parse(a.nextSessionAt as string) - Date.parse(b.nextSessionAt as string));
    return upcoming[0] ?? null;
  }, [dashboard.data, filters.eventIds]);

  const now = summary.data?.current ?? null;
  const before = summary.data?.previous ?? null;
  const loading = summary.isPending;
  const empty = now !== null && now.ordersTotal === 0;
  const compareLabel = summary.data?.previousPeriod
    ? `so với ${formatDay(summary.data.previousPeriod.from)} – ${formatDay(summary.data.previousPeriod.to)}`
    : undefined;

  const fillRows = fillBars(stockRows, directory.sessions, MAX_SESSION_BARS);
  const arrivalBars: RatioRow[] = [...opened]
    .sort((a, b) => startOf(directory.sessions, b.eventSessionId) - startOf(directory.sessions, a.eventSessionId))
    .slice(0, MAX_SESSION_BARS)
    .map((row) => ({
      key: row.eventSessionId,
      ...sessionLabel(directory.sessions, row.eventSessionId),
      part: row.arrived,
      whole: row.ticketsIssued,
    }));

  return (
    <>
      <PageHeader title="Tổng quan" description={organization.name} />

      <div className="grid gap-4">
        <StatsFilterBar organizationId={organization.id} filters={filters} resolved={resolved} onChange={update} onReset={reset} />

        {summary.isError ? (
          <ErrorState error={null} onRetry={() => void summary.refetch()} />
        ) : (
          <Section
            title="Trong kỳ"
            description={`${formatDay(resolved.params.from)} – ${formatDay(resolved.params.to)}. Đơn được tính theo thời điểm đặt.`}
          >
            {empty ? (
              <p className="m-0 mb-3 rounded-nt border border-dashed border-border px-3 py-2 text-[13px] text-muted">
                Chưa có dữ liệu: không có đơn hàng nào được tạo trong khoảng thời gian và bộ lọc này.
              </p>
            ) : null}
            <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${summary.isPlaceholderData ? 'opacity-60' : ''}`}>
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
                label="Số đơn"
                help={METRIC_HELP.orders}
                loading={loading}
                value={empty || !now ? null : formatNumber(now.ordersTotal)}
                delta={empty ? null : delta(now?.ordersTotal ?? null, before?.ordersTotal)}
                deltaLabel={compareLabel}
                hint={now && !empty ? `${formatNumber(now.ordersPaid)} đã thanh toán` : undefined}
                icon={<ReceiptText />}
              />
              <KpiCard
                label="Giá trị đơn trung bình"
                help={METRIC_HELP.averageOrderValue}
                loading={loading}
                value={perPaidOrder(now, 'grossVnd', formatMoney)}
                delta={delta(perPaid(now, 'grossVnd'), perPaid(before, 'grossVnd'))}
                deltaLabel={compareLabel}
                icon={<ShoppingCart />}
              />
              <KpiCard
                label="Số vé mỗi đơn"
                help={METRIC_HELP.ticketsPerOrder}
                loading={loading}
                value={perPaidOrder(now, 'ticketsSold', (value) => value.toLocaleString('vi-VN', { maximumFractionDigits: 2 }))}
                delta={delta(perPaid(now, 'ticketsSold'), perPaid(before, 'ticketsSold'))}
                deltaLabel={compareLabel}
                icon={<Ticket />}
              />
              <KpiCard
                label="Tỉ lệ thanh toán"
                help={METRIC_HELP.paymentRate}
                loading={loading}
                value={now && now.ordersTotal > 0 ? formatPercent(ratio(now.ordersPaid, now.ordersTotal), 1) : null}
                delta={delta(paymentRate(now), paymentRate(before))}
                deltaLabel={compareLabel}
                icon={<Percent />}
              />
            </div>
          </Section>
        )}

        <Section
          title="Hiện tại"
          description="Trạng thái lúc mở trang, theo sự kiện và suất đang chọn. Không phụ thuộc khoảng thời gian."
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Lấp đầy"
              help={METRIC_HELP.occupancy}
              loading={stock.isPending}
              value={stock.isError || capacity === 0 ? null : `${formatNumber(sold)} / ${formatNumber(capacity)}`}
              progress={stock.isError ? undefined : ratio(sold, capacity)}
              hint={
                stock.isError
                  ? 'Chưa hỏi được tồn kho'
                  : capacity === 0
                    ? 'Chưa có suất nào mở bán'
                    : `${formatPercent(ratio(sold, capacity), 1)} số chỗ đã bán`
              }
              icon={<Users />}
            />
            <KpiCard
              label="Đang giữ chỗ"
              help={METRIC_HELP.held}
              loading={stock.isPending}
              value={stock.isError ? null : formatNumber(held)}
              hint={
                stock.isError
                  ? 'Chưa hỏi được tồn kho'
                  : `${formatNumber(expiring)} chỗ hết hạn trong ${stock.data?.expiringWithinMinutes ?? 5} phút tới`
              }
              icon={<Hourglass />}
            />
            <KpiCard
              label="Tỉ lệ đến"
              help={METRIC_HELP.arrivalRate}
              loading={presence.isPending}
              value={presence.isError || issued === 0 ? null : formatPercent(ratio(arrived, issued), 1)}
              hint={
                presence.isError
                  ? 'Chưa hỏi được số liệu soát vé'
                  : issued === 0
                    ? 'Chưa có suất nào mở cổng'
                    : `${formatNumber(arrived)}/${formatNumber(issued)} vé · ${formatNumber(opened.length)} suất đã mở cổng`
              }
              icon={<DoorOpen />}
            />
            <KpiCard
              label="Suất diễn gần nhất"
              help={METRIC_HELP.daysToShow}
              loading={dashboard.isPending}
              value={nextShow ? daysUntil(nextShow.nextSessionAt as string) : null}
              hint={
                nextShow
                  ? `${nextShow.title} · ${formatDateTime(nextShow.nextSessionAt as string)}`
                  : 'Không có suất nào sắp diễn'
              }
              icon={<CalendarClock />}
            />
          </div>
        </Section>

        <Panel>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="m-0 text-[15px] font-semibold">
              Doanh thu theo {BUCKET_NAME[resolved.bucket]}
              {resolved.compare ? <span className="font-normal text-muted"> · nét đứt là kỳ trước</span> : null}
            </h2>
            <Link href={queryString ? `/sales?${queryString}` : '/sales'} className="text-[13px] font-semibold text-primary-text">
              Xem chi tiết doanh thu →
            </Link>
          </div>
          {series.isError ? (
            <ErrorState error={null} onRetry={() => void series.refetch()} />
          ) : series.isPending ? (
            <Skeleton lines={6} />
          ) : empty ? (
            <p className="m-0 py-8 text-center text-[13px] text-muted">Chưa có dữ liệu trong khoảng thời gian này.</p>
          ) : (
            <div className={series.isPlaceholderData ? 'opacity-60' : undefined}>
              <RevenueTrendChart points={series.data.current} previous={series.data.previous} bucket={series.data.bucket} height={260} />
            </div>
          )}
        </Panel>

        <div className="grid gap-4 xl:grid-cols-2">
          <Panel>
            {stock.isPending ? (
              <Skeleton lines={6} />
            ) : fillRows.length === 0 ? (
              <ChartEmpty title="Lấp đầy từng suất" text="Chưa có suất nào mở bán trong phạm vi bộ lọc." />
            ) : (
              <RatioBars caption={captionOf('Lấp đầy từng suất', fillRows.length, inScope.size, 'sắp diễn')} rows={fillRows} unit="chỗ" />
            )}
          </Panel>
          <Panel>
            {presence.isPending ? (
              <Skeleton lines={6} />
            ) : arrivalBars.length === 0 ? (
              <ChartEmpty title="Tỉ lệ đến theo suất" text="Chưa có suất nào mở cổng soát vé trong phạm vi bộ lọc." />
            ) : (
              <RatioBars caption={captionOf('Tỉ lệ đến theo suất', arrivalBars.length, opened.length, 'gần nhất')} rows={arrivalBars} unit="vé" />
            )}
          </Panel>
        </div>

        <EventExplorer organization={organization} />
      </div>
    </>
  );
}

const BUCKET_NAME = { hour: 'giờ', day: 'ngày', week: 'tuần' } as const;

function sum<T>(rows: T[], pick: (row: T) => number): number {
  return rows.reduce((total, row) => total + pick(row), 0);
}

function perPaid(totals: SalesTotals | null, key: 'grossVnd' | 'ticketsSold'): number | null {
  return totals && totals.ordersPaid > 0 ? totals[key] / totals.ordersPaid : null;
}

function perPaidOrder(totals: SalesTotals | null, key: 'grossVnd' | 'ticketsSold', format: (value: number) => string) {
  const value = perPaid(totals, key);
  return value === null ? null : format(value);
}

function paymentRate(totals: SalesTotals | null): number | null {
  return totals && totals.ordersTotal > 0 ? totals.ordersPaid / totals.ordersTotal : null;
}

function daysUntil(iso: string): string {
  const days = Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000);
  return days <= 1 ? 'Trong 24 giờ tới' : `Còn ${days} ngày`;
}

function captionOf(title: string, shown: number, total: number, order: string): string {
  return total > shown ? `${title} · ${shown} suất ${order}` : title;
}

function ChartEmpty({ title, text }: { title: string; text: string }) {
  return (
    <>
      <h2 className="m-0 mb-3 text-[14px] font-semibold">{title}</h2>
      <p className="m-0 py-8 text-center text-[13px] text-muted">{text}</p>
    </>
  );
}
