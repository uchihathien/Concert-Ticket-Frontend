'use client';

import {
  useGateActivity,
  useGateNoShows,
  useGatePresence,
  useInventoryStock,
  useOrganizationMembers,
  type GateOverride,
  type GateRow,
  type GateScannerRow,
  type OrganizationSummary,
} from '@nexaticket/ts-sdk';
import {
  BarChart,
  Button,
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
  formatTime,
  roleLabel,
  toCsv,
} from '@nexaticket/ui';
import { Ban, Banknote, DoorOpen, Download, Hand, LogIn, RotateCcw, UserX, Users } from 'lucide-react';
import { Suspense, useMemo } from 'react';
import { OrganizationGate } from '@/components/OrganizationGate';
import { KpiCard } from '@/components/stats/KpiCard';
import { RatioBars } from '@/components/stats/SimpleCharts';
import { StatsFilterBar } from '@/components/stats/StatsFilterBar';
import { CountBarsChart } from '@/components/stats/lazy-charts';
import { sessionLabel, sessionText, startOf } from '@/components/stats/session-helpers';
import { useSessionDirectory } from '@/components/stats/useSessionDirectory';
import { METRIC_HELP } from '@/lib/stats-definitions';
import { useStatsFilters } from '@/lib/stats-filters';
import { formatMoney, formatPercent, ratio } from '@/lib/stats-math';

/**
 * A-CHECKINS — thống kê soát vé.
 *
 * <h3>Hai loại con số</h3>
 *
 * - **Hiện tại** (tỉ lệ đến, đang ở trong, vắng mặt): trạng thái của vé lúc mở trang.
 * - **Trong kỳ** (lượt vào, vào lại, bị từ chối, cho vào thủ công, hiệu suất nhân viên): đếm trên
 *   nhật ký quét, theo THỜI ĐIỂM QUÉT nằm trong khoảng thời gian đang chọn.
 *
 * Cả hai đều theo bộ lọc sự kiện và suất. Loại vé không áp dụng: nhật ký quét ghi theo vé và suất.
 *
 * <h3>Không có dữ liệu cá nhân của khách</h3>
 *
 * Trang này không hiện tên khách ở đâu cả — kể cả ở danh sách cho vào thủ công, nơi chỉ có ai làm,
 * khi nào, ở cổng nào và vì sao.
 */
export default function CheckinsPage() {
  return (
    <OrganizationGate title="Soát vé">
      {(organization) => (
        <Suspense
          fallback={
            <>
              <PageHeader title="Soát vé" description={organization.name} />
              <Panel>
                <Skeleton lines={4} />
              </Panel>
            </>
          }
        >
          <CheckinsBody organization={organization} />
        </Suspense>
      )}
    </OrganizationGate>
  );
}

/** Server nhận tối đa 200 suất mỗi lần hỏi. */
const MAX_SESSION_FILTER = 200;
const MAX_ARRIVAL_BARS = 8;

const REJECT_LABEL: Record<string, string> = {
  ALREADY_CHECKED_IN: 'Vé đã dùng (đang ở trong)',
  WRONG_SESSION: 'Sai suất diễn',
  INVALID_TOKEN: 'Mã không hợp lệ (nghi vé giả)',
  NOT_FOUND: 'Không tìm thấy vé',
  REVOKED: 'Vé đã bị huỷ',
  NOT_OPEN_YET: 'Chưa tới giờ mở cổng',
  SESSION_ENDED: 'Suất đã kết thúc',
  REENTRY_NOT_ALLOWED: 'Không được vào lại',
  NOT_INSIDE: 'Quét ra khi chưa vào',
};

const METHOD_LABEL: Record<string, string> = { QR: 'Quét mã QR', CODE: 'Nhập mã vé', OVERRIDE: 'Cho vào thủ công' };

function CheckinsBody({ organization }: { organization: OrganizationSummary }) {
  const { filters, resolved, update, reset } = useStatsFilters();
  const directory = useSessionDirectory(organization.id);
  const presence = useGatePresence(organization.id);
  const members = useOrganizationMembers(organization.id);

  // Nhật ký quét chỉ mang mã suất. Lọc theo sự kiện nghĩa là đổi sự kiện thành các suất của nó.
  const scope = useMemo(() => {
    if (filters.sessionId) return { ids: [filters.sessionId], ready: true, clipped: false };
    if (filters.eventIds.length === 0) return { ids: undefined, ready: true, clipped: false };
    const ids = [...directory.sessions.entries()]
      .filter(([, info]) => filters.eventIds.includes(info.eventId))
      .map(([id]) => id);
    return { ids: ids.slice(0, MAX_SESSION_FILTER), ready: !directory.loading, clipped: ids.length > MAX_SESSION_FILTER };
  }, [filters.sessionId, filters.eventIds, directory.sessions, directory.loading]);

  const activityParams = useMemo(
    () => ({ from: resolved.params.from, to: resolved.params.to, sessionIds: scope.ids }),
    [resolved.params.from, resolved.params.to, scope.ids],
  );
  // Đang lọc theo sự kiện mà sự kiện ấy không có suất nào: không hỏi server (danh sách suất rỗng
  // sẽ bị hiểu là "mọi suất") và coi như không có hoạt động.
  const nothingInScope = scope.ids !== undefined && scope.ids.length === 0;
  const activity = useGateActivity(organization.id, activityParams, scope.ready && !nothingInScope);

  const inScope = useMemo(() => (scope.ids ? new Set(scope.ids) : null), [scope.ids]);
  const presenceRows = useMemo(
    () => (presence.data?.sessions ?? []).filter((row) => inScope === null || inScope.has(row.eventSessionId)),
    [presence.data, inScope],
  );

  const nowMs = Date.now();
  const opened = presenceRows.filter((row) => row.arrived > 0);
  const arrived = sum(opened, (row) => row.arrived);
  const issuedOpened = sum(opened, (row) => row.ticketsIssued);
  const inside = sum(presenceRows, (row) => row.inside);
  // Vắng mặt chỉ có nghĩa với suất ĐÃ kết thúc: người chưa tới của một suất tối nay chưa vắng.
  const finished = presenceRows.filter((row) => {
    const info = directory.sessions.get(row.eventSessionId);
    return info !== undefined && Date.parse(info.endsAt ?? info.startsAt) < nowMs;
  });
  const noShow = sum(finished, (row) => Math.max(0, row.ticketsIssued - row.arrived));

  // Tiền vé của những chỗ vắng mặt: ticketing biết vé nào không đến (theo loại vé), inventory biết
  // giá niêm yết của loại vé ấy trong suất ấy. Ghép ở đây vì hai service không biết về nhau.
  const finishedIds = useMemo(
    () => finished.map((row) => row.eventSessionId).sort().slice(0, MAX_SESSION_FILTER),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [finished.map((row) => row.eventSessionId).join()],
  );
  const noShowRows = useGateNoShows(organization.id, finishedIds);
  const stock = useInventoryStock(organization.id);
  const noShowValue = useMemo(() => {
    if (!noShowRows.data || !stock.data) return null;
    const price = new Map(stock.data.ticketTypes.map((row) => [`${row.eventSessionId}:${row.ticketTypeName}`, row.priceVnd]));
    let total = 0;
    for (const row of noShowRows.data.rows) {
      const unit = price.get(`${row.eventSessionId}:${row.ticketTypeName}`);
      // Loại vé không còn trong tồn kho (đã đổi tên hoặc gỡ) thì không đoán giá: bỏ qua dòng đó.
      if (unit !== undefined) total += unit * row.tickets;
    }
    return total;
  }, [noShowRows.data, stock.data]);
  const issuedFinished = sum(finished, (row) => row.ticketsIssued);

  const totals = nothingInScope ? EMPTY_TOTALS : (activity.data?.totals ?? null);
  const loading = !nothingInScope && activity.isPending;
  const quiet = totals !== null && totals.scans === 0;
  const overrideCount = (activity.data?.entriesByMethod ?? []).find((item) => item.key === 'OVERRIDE')?.count ?? 0;

  const nameOf = useMemo(
    () => new Map((members.data ?? []).map((member) => [member.userId, member])),
    [members.data],
  );
  const scannerName = (userId: string) => nameOf.get(userId)?.fullName ?? nameOf.get(userId)?.email ?? `Người dùng ${userId.slice(0, 8)}`;

  const flowBySession = useMemo(
    () => new Map((activity.data?.sessions ?? []).map((row) => [row.eventSessionId, row])),
    [activity.data],
  );
  const sessionRows = useMemo(
    () =>
      [...presenceRows]
        .filter((row) => row.arrived > 0 || flowBySession.has(row.eventSessionId))
        .sort((a, b) => startOf(directory.sessions, b.eventSessionId) - startOf(directory.sessions, a.eventSessionId)),
    [presenceRows, flowBySession, directory.sessions],
  );

  const arrivalBars = sessionRows
    .filter((row) => row.arrived > 0)
    .slice(0, MAX_ARRIVAL_BARS)
    .map((row) => ({
      key: row.eventSessionId,
      ...sessionLabel(directory.sessions, row.eventSessionId),
      part: row.arrived,
      whole: row.ticketsIssued,
    }));

  const timeline = (activity.data?.timeline ?? []).map((point) => {
    const [date = '', time = ''] = point.bucket.split('T');
    const [, month, day] = date.split('-');
    return {
      key: point.bucket,
      label: time.slice(0, 5),
      title: `${time.slice(0, 5)}–${plus15(time)} ngày ${day}/${month}`,
      value: point.entries,
      secondary: point.exits,
    };
  });

  function exportCsv() {
    downloadCsv(
      csvFilename(['soat-ve', resolved.params.from, resolved.params.to]),
      toCsv([
        {
          title: 'THEO SUẤT DIỄN',
          headers: ['Sự kiện · suất', 'Vé phát hành', 'Đã đến', 'Tỉ lệ đến (%)', 'Đang ở trong', 'Lượt vào trong kỳ', 'Vào lại', 'Bị từ chối', 'Vào sớm nhất', 'Vào muộn nhất', 'Giờ vào trung bình'],
          rows: sessionRows.map((row) => {
            const flow = flowBySession.get(row.eventSessionId);
            return [
              sessionText(directory.sessions, row.eventSessionId),
              row.ticketsIssued,
              row.arrived,
              row.ticketsIssued > 0 ? Math.round((row.arrived / row.ticketsIssued) * 100) : '',
              row.inside,
              flow?.entries ?? 0,
              flow ? flow.entries - flow.uniqueTickets : 0,
              flow?.rejected ?? 0,
              flow?.firstEntryAt ? formatDateTime(flow.firstEntryAt) : '',
              flow?.lastEntryAt ? formatDateTime(flow.lastEntryAt) : '',
              flow?.averageEntryAt ? formatDateTime(flow.averageEntryAt) : '',
            ];
          }),
        },
        {
          title: 'THEO NGƯỜI QUÉT',
          headers: ['Người quét', 'Vai trò', 'Vé cho vào', 'Bị từ chối', 'Lượt ra', 'Cho vào thủ công', 'Vé/phút', 'Lượt đầu', 'Lượt cuối'],
          rows: (activity.data?.scanners ?? []).map((row) => [
            scannerName(row.userId),
            nameOf.get(row.userId) ? roleLabel(nameOf.get(row.userId)!.role) : '',
            row.accepted,
            row.rejected,
            row.exits,
            row.overrides,
            row.activeMinutes > 0 ? (row.accepted / row.activeMinutes).toFixed(2) : '',
            row.firstScanAt ? formatDateTime(row.firstScanAt) : '',
            row.lastScanAt ? formatDateTime(row.lastScanAt) : '',
          ]),
        },
      ]),
    );
  }

  return (
    <>
      <PageHeader
        title="Soát vé"
        description={organization.name}
        actions={
          <Button variant="secondary" disabled={sessionRows.length === 0} onClick={exportCsv}>
            <Download size={16} aria-hidden="true" /> Xuất CSV
          </Button>
        }
      />

      <div className="grid gap-4">
        <StatsFilterBar
          organizationId={organization.id}
          filters={filters}
          resolved={resolved}
          onChange={update}
          onReset={reset}
          showTicketType={false}
          showBucket={false}
          showCompare={false}
        />
        {scope.clipped ? (
          <p className="m-0 rounded-nt border border-dashed border-border px-3 py-2 text-[13px] text-warn-text">
            Các sự kiện đang chọn có hơn {MAX_SESSION_FILTER} suất; số liệu trong kỳ chỉ tính {MAX_SESSION_FILTER} suất gần nhất.
          </p>
        ) : null}

        <Section title="Hiện tại" description="Trạng thái của vé lúc mở trang, theo sự kiện và suất đang chọn.">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Tỉ lệ đến"
              help={METRIC_HELP.arrivalRate}
              loading={presence.isPending}
              value={presence.isError || issuedOpened === 0 ? null : formatPercent(ratio(arrived, issuedOpened), 1)}
              hint={
                presence.isError
                  ? 'Chưa hỏi được số liệu soát vé'
                  : issuedOpened === 0
                    ? 'Chưa có suất nào mở cổng'
                    : `${formatNumber(arrived)}/${formatNumber(issuedOpened)} vé · ${formatNumber(opened.length)} suất đã mở cổng`
              }
              icon={<DoorOpen />}
            />
            <KpiCard
              label="Đang ở trong"
              help={METRIC_HELP.inside}
              loading={presence.isPending}
              value={presence.isError ? null : formatNumber(inside)}
              hint={presence.isError ? 'Chưa hỏi được số liệu soát vé' : 'khách đã quét vào và chưa quét ra'}
              icon={<Users />}
            />
            <KpiCard
              label="Vắng mặt"
              help={METRIC_HELP.noShow}
              loading={presence.isPending || directory.loading}
              value={presence.isError || finished.length === 0 ? null : formatNumber(noShow)}
              hint={
                finished.length === 0
                  ? 'Chưa có suất nào kết thúc'
                  : `${formatPercent(ratio(noShow, issuedFinished), 1)} số vé của ${formatNumber(finished.length)} suất đã kết thúc`
              }
              icon={<UserX />}
            />
            <KpiCard
              label="Tiền vé của chỗ vắng mặt"
              help={METRIC_HELP.noShowValue}
              loading={presence.isPending || directory.loading || (finishedIds.length > 0 && (noShowRows.isPending || stock.isPending))}
              value={finished.length === 0 || noShowValue === null ? null : formatMoney(noShowValue)}
              hint={finished.length === 0 ? 'Chưa có suất nào kết thúc' : 'theo giá niêm yết của từng loại vé'}
              icon={<Banknote />}
            />
          </div>
        </Section>

        {activity.isError ? (
          <ErrorState error={null} onRetry={() => void activity.refetch()} />
        ) : (
          <>
            <Section title="Trong kỳ" description="Đếm trên nhật ký quét, theo thời điểm quét trong khoảng thời gian đang chọn.">
              {quiet ? (
                <p className="m-0 mb-3 rounded-nt border border-dashed border-border px-3 py-2 text-[13px] text-muted">
                  Chưa có dữ liệu: không có lượt quét nào trong khoảng thời gian và bộ lọc này.
                </p>
              ) : null}
              <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-4 ${activity.isPlaceholderData ? 'opacity-60' : ''}`}>
                <KpiCard
                  label="Lượt vào"
                  help={METRIC_HELP.entries}
                  loading={loading}
                  value={quiet || !totals ? null : formatNumber(totals.entries)}
                  hint={totals && !quiet ? `${formatNumber(totals.uniqueTickets)} vé khác nhau · ${formatNumber(totals.exits)} lượt ra` : undefined}
                  icon={<LogIn />}
                />
                <KpiCard
                  label="Vào lại"
                  help={METRIC_HELP.reentries}
                  loading={loading}
                  value={quiet || !totals ? null : formatNumber(totals.entries - totals.uniqueTickets)}
                  hint={
                    totals && totals.uniqueTickets > 0
                      ? `trung bình ${(totals.entries / totals.uniqueTickets).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} lượt vào mỗi vé`
                      : undefined
                  }
                  icon={<RotateCcw />}
                />
                <KpiCard
                  label="Bị từ chối"
                  help={METRIC_HELP.rejected}
                  loading={loading}
                  value={quiet || !totals ? null : formatNumber(totals.rejected)}
                  hint={totals && !quiet ? `${formatPercent(ratio(totals.rejected, totals.scans), 1)} tổng số lượt quét` : undefined}
                  icon={<Ban />}
                />
                <KpiCard
                  label="Cho vào thủ công"
                  help={METRIC_HELP.overrides}
                  loading={loading}
                  value={quiet || !totals ? null : formatNumber(overrideCount)}
                  hint={totals && !quiet ? `${formatPercent(ratio(overrideCount, totals.entries), 1)} số lượt vào` : undefined}
                  icon={<Hand />}
                />
              </div>
            </Section>

            {quiet ? null : (
              <>
                <Panel>
                  <h2 className="m-0 mb-1 text-[15px] font-semibold">Lượng khách vào theo khung 15 phút</h2>
                  <p className="m-0 mb-3 text-[13px] text-muted">
                    Chỉ hiện các khung có lượt quét, giờ Việt Nam.
                    {activity.data?.timelineTruncated ? ' Kỳ này có quá nhiều khung; biểu đồ hiện 400 khung gần nhất.' : ''}
                  </p>
                  {loading ? (
                    <Skeleton lines={6} />
                  ) : (
                    <CountBarsChart caption="Lượng khách vào theo khung 15 phút" valueName="Lượt vào" secondaryName="Lượt ra" rows={timeline} />
                  )}
                </Panel>

                <div className="grid gap-4 xl:grid-cols-2">
                  <Panel>
                    {arrivalBars.length === 0 ? (
                      <p className="m-0 py-8 text-center text-[13px] text-muted">Chưa có suất nào có khách vào.</p>
                    ) : (
                      <RatioBars caption="Tỉ lệ đến theo suất" rows={arrivalBars} unit="vé" />
                    )}
                  </Panel>
                  <Panel>
                    {(activity.data?.rejectedByReason ?? []).length === 0 ? (
                      <>
                        <h2 className="m-0 mb-3 text-[14px] font-semibold">Lượt quét bị từ chối theo lý do</h2>
                        <p className="m-0 py-8 text-center text-[13px] text-muted">Không có lượt quét nào bị từ chối trong kỳ.</p>
                      </>
                    ) : (
                      <BarChart
                        caption="Lượt quét bị từ chối theo lý do"
                        rows={(activity.data?.rejectedByReason ?? []).map((item) => ({
                          key: item.key,
                          label: REJECT_LABEL[item.key] ?? item.key,
                          value: item.count,
                          hint: `${formatPercent(ratio(item.count, totals?.rejected ?? 0), 1)} số lượt bị từ chối`,
                        }))}
                        format={(value) => `${formatNumber(value)} lượt`}
                      />
                    )}
                  </Panel>
                </div>

                <Section title="Theo suất diễn" description="Giờ vào tính trên lần vào đầu tiên của mỗi vé, so với giờ diễn.">
                  <Table
                    caption="Soát vé theo suất diễn"
                    rows={sessionRows}
                    rowKey={(row) => row.eventSessionId}
                    loading={presence.isPending}
                    emptyTitle="Chưa có suất nào có lượt quét"
                    columns={[
                      { key: 'session', header: 'Sự kiện · suất', cell: (row) => sessionText(directory.sessions, row.eventSessionId) },
                      { key: 'arrived', header: 'Đã đến', numeric: true, cell: (row) => `${formatNumber(row.arrived)}/${formatNumber(row.ticketsIssued)}` },
                      { key: 'rate', header: 'Tỉ lệ đến', numeric: true, cell: (row) => formatPercent(ratio(row.arrived, row.ticketsIssued), 1) },
                      { key: 'inside', header: 'Đang ở trong', numeric: true, cell: (row) => formatNumber(row.inside) },
                      {
                        key: 'first',
                        header: 'Sớm nhất',
                        cell: (row) => relativeToShow(flowBySession.get(row.eventSessionId)?.firstEntryAt, directory.sessions.get(row.eventSessionId)?.startsAt),
                      },
                      {
                        key: 'last',
                        header: 'Muộn nhất',
                        cell: (row) => relativeToShow(flowBySession.get(row.eventSessionId)?.lastEntryAt, directory.sessions.get(row.eventSessionId)?.startsAt),
                      },
                      {
                        key: 'avg',
                        header: 'Trung bình',
                        cell: (row) => relativeToShow(flowBySession.get(row.eventSessionId)?.averageEntryAt, directory.sessions.get(row.eventSessionId)?.startsAt),
                      },
                      {
                        key: 'reentry',
                        header: 'Vào lại',
                        numeric: true,
                        cell: (row) => {
                          const flow = flowBySession.get(row.eventSessionId);
                          return flow ? formatNumber(flow.entries - flow.uniqueTickets) : '—';
                        },
                      },
                      { key: 'rejected', header: 'Từ chối', numeric: true, cell: (row) => formatNumber(flowBySession.get(row.eventSessionId)?.rejected ?? 0) },
                    ]}
                  />
                </Section>

                <Section
                  title="Hiệu suất người quét"
                  description="Gồm cả ban tổ chức nếu đã tự quét. Vé/phút tính trên những phút có ít nhất một lượt quét."
                >
                  <Table<GateScannerRow>
                    caption="Hiệu suất người quét"
                    rows={activity.data?.scanners ?? []}
                    rowKey={(row) => row.userId}
                    loading={loading}
                    emptyTitle="Chưa có ai quét vé trong kỳ"
                    columns={[
                      { key: 'name', header: 'Người quét', cell: (row) => scannerName(row.userId) },
                      { key: 'role', header: 'Vai trò', cell: (row) => (nameOf.get(row.userId) ? roleLabel(nameOf.get(row.userId)!.role) : '—') },
                      { key: 'accepted', header: 'Vé cho vào', numeric: true, cell: (row) => formatNumber(row.accepted) },
                      { key: 'rejected', header: 'Từ chối', numeric: true, cell: (row) => formatNumber(row.rejected) },
                      { key: 'exits', header: 'Lượt ra', numeric: true, cell: (row) => formatNumber(row.exits) },
                      { key: 'overrides', header: 'Thủ công', numeric: true, cell: (row) => formatNumber(row.overrides) },
                      {
                        key: 'speed',
                        header: 'Vé/phút',
                        numeric: true,
                        cell: (row) =>
                          row.activeMinutes > 0
                            ? (row.accepted / row.activeMinutes).toLocaleString('vi-VN', { maximumFractionDigits: 1 })
                            : '—',
                      },
                      {
                        key: 'window',
                        header: 'Khung giờ làm việc',
                        cell: (row) =>
                          row.firstScanAt && row.lastScanAt ? `${formatDateTime(row.firstScanAt)} → ${formatDateTime(row.lastScanAt)}` : '—',
                      },
                    ]}
                  />
                </Section>

                <div className="grid gap-4 xl:grid-cols-2">
                  <Section title="Theo cổng">
                    <Table<GateRow>
                      caption="Soát vé theo cổng"
                      rows={activity.data?.gates ?? []}
                      rowKey={(row) => row.gate ?? '__none__'}
                      loading={loading}
                      emptyTitle="Chưa có dữ liệu cổng"
                      columns={[
                        // Lượt quét không ghi cổng (thiết bị cũ, hoặc nhân viên bỏ trống) vẫn là lượt quét thật.
                        { key: 'gate', header: 'Cổng', cell: (row) => row.gate ?? 'Không ghi cổng' },
                        { key: 'accepted', header: 'Vé cho vào', numeric: true, cell: (row) => formatNumber(row.accepted) },
                        { key: 'exits', header: 'Lượt ra', numeric: true, cell: (row) => formatNumber(row.exits) },
                        { key: 'rejected', header: 'Từ chối', numeric: true, cell: (row) => formatNumber(row.rejected) },
                      ]}
                    />
                  </Section>
                  <Section title="Cách vào cửa">
                    <Panel>
                      {(activity.data?.entriesByMethod ?? []).length === 0 ? (
                        <p className="m-0 py-6 text-center text-[13px] text-muted">Chưa có lượt vào nào trong kỳ.</p>
                      ) : (
                        <BarChart
                          caption="Lượt vào theo cách vào cửa"
                          rows={(activity.data?.entriesByMethod ?? []).map((item) => ({
                            key: item.key,
                            label: METHOD_LABEL[item.key] ?? item.key,
                            value: item.count,
                            hint: `${formatPercent(ratio(item.count, totals?.entries ?? 0), 1)} số lượt vào`,
                          }))}
                          format={(value) => `${formatNumber(value)} lượt`}
                        />
                      )}
                    </Panel>
                  </Section>
                </div>

                <Section title="Cho vào thủ công" description="50 lượt gần nhất trong kỳ: ai thực hiện, khi nào, ở cổng nào và vì sao.">
                  <Table<GateOverride>
                    caption="Các lượt cho vào thủ công"
                    rows={activity.data?.overrides ?? []}
                    rowKey={(row) => `${row.scannedAt}:${row.ticketCode ?? ''}:${row.scannedBy}`}
                    loading={loading}
                    emptyTitle="Không có lượt cho vào thủ công nào trong kỳ"
                    columns={[
                      { key: 'at', header: 'Thời điểm', cell: (row) => formatDateTime(row.scannedAt) },
                      { key: 'by', header: 'Người thực hiện', cell: (row) => scannerName(row.scannedBy) },
                      { key: 'gate', header: 'Cổng', cell: (row) => row.gate ?? '—' },
                      { key: 'reason', header: 'Lý do', cell: (row) => row.reason ?? '—' },
                      { key: 'ticket', header: 'Mã vé', cell: (row) => (row.ticketCode ? <code>{row.ticketCode}</code> : '—') },
                      { key: 'session', header: 'Sự kiện · suất', cell: (row) => sessionText(directory.sessions, row.eventSessionId) },
                    ]}
                  />
                </Section>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

const EMPTY_TOTALS = { scans: 0, entries: 0, uniqueTickets: 0, exits: 0, rejected: 0 };

function sum<T>(rows: T[], pick: (row: T) => number): number {
  return rows.reduce((total, row) => total + pick(row), 0);
}

function plus15(time: string): string {
  const [hour = '0', minute = '0'] = time.split(':');
  const total = (Number(hour) * 60 + Number(minute) + 15) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** "19:02 · trước 58 phút": giờ vào kèm khoảng cách tới giờ diễn — con số trần không nói sớm hay muộn. */
function relativeToShow(at: string | null | undefined, startsAt: string | undefined): string {
  if (!at) return '—';
  if (!startsAt) return formatTime(at);
  const minutes = Math.round((Date.parse(at) - Date.parse(startsAt)) / 60_000);
  const gap = Math.abs(minutes) >= 60 ? `${Math.floor(Math.abs(minutes) / 60)} giờ ${Math.abs(minutes) % 60} phút` : `${Math.abs(minutes)} phút`;
  return `${formatTime(at)} · ${minutes === 0 ? 'đúng giờ diễn' : minutes < 0 ? `trước ${gap}` : `sau ${gap}`}`;
}
