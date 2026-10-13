'use client';

import {
  ApiError,
  useExportBuyers,
  useHasPermission,
  useSalesCustomers,
  useSalesSummary,
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
  csvFilename,
  downloadCsv,
  formatDateTime,
  formatNumber,
  toCsv,
} from '@nexaticket/ui';
import { Download, Repeat, ShieldCheck, UserCheck, UserPlus, Users } from 'lucide-react';
import { Suspense, useMemo, useState } from 'react';
import { OrganizationGate } from '@/components/OrganizationGate';
import { KpiCard } from '@/components/stats/KpiCard';
import { StatsFilterBar } from '@/components/stats/StatsFilterBar';
import { CountBarsChart } from '@/components/stats/lazy-charts';
import { sessionText } from '@/components/stats/session-helpers';
import { useSessionDirectory } from '@/components/stats/useSessionDirectory';
import { METRIC_HELP } from '@/lib/stats-definitions';
import { useStatsFilters } from '@/lib/stats-filters';
import { formatPercent, ratio } from '@/lib/stats-math';

/**
 * A-CUSTOMERS — khách hàng của tổ chức.
 *
 * <h3>Số đếm, không phải hồ sơ</h3>
 *
 * Trang này trả lời "bao nhiêu người mua, bao nhiêu người quay lại" bằng những con số đã gộp ở
 * server. Không có bảng khách hàng, không có email, không có nhân khẩu học: hệ thống không thu thập
 * tuổi, giới tính hay khu vực, và trang thống kê không phải lý do để bắt đầu thu thập.
 *
 * <h3>Một lối ra duy nhất cho dữ liệu cá nhân</h3>
 *
 * Xuất danh sách người mua là chỗ DUY NHẤT trong khu thống kê đưa tên đầy đủ ra khỏi hệ thống. Nó
 * chỉ mở cho chủ tổ chức và quản trị, mỗi lần bấm để lại một dòng trong Nhật ký, và server từ chối
 * xuất nếu không ghi được dòng ấy.
 */
export default function CustomersPage() {
  return (
    <OrganizationGate title="Khách hàng">
      {(organization) => (
        <Suspense
          fallback={
            <>
              <PageHeader title="Khách hàng" description={organization.name} />
              <Panel>
                <Skeleton lines={4} />
              </Panel>
            </>
          }
        >
          <CustomersBody organization={organization} />
        </Suspense>
      )}
    </OrganizationGate>
  );
}

function CustomersBody({ organization }: { organization: OrganizationSummary }) {
  const { filters, resolved, update, reset } = useStatsFilters();
  const customers = useSalesCustomers(organization.id, resolved.params);
  const summary = useSalesSummary(organization.id, resolved.params, false);
  const directory = useSessionDirectory(organization.id);

  const data = customers.data ?? null;
  const loading = customers.isPending;
  const empty = data !== null && data.buyers === 0;
  const paidOrders = summary.data?.current.ordersPaid ?? null;

  const perBuyer = (data?.ordersPerBuyer ?? []).map((bucket) => ({
    key: String(bucket.tickets),
    label: bucket.tickets >= 5 ? '5+ đơn' : `${bucket.tickets} đơn`,
    title: bucket.tickets >= 5 ? 'Người mua có từ 5 đơn trở lên' : `Người mua có ${bucket.tickets} đơn`,
    value: bucket.orders,
  }));

  // Phạm vi xuất đi theo đúng bộ lọc đang nhìn: một suất, các suất của những sự kiện đã chọn, hoặc
  // cả tổ chức.
  const exportScope = useMemo(() => {
    if (filters.sessionId) return [filters.sessionId];
    if (filters.eventIds.length === 0) return [];
    return [...directory.sessions.entries()].filter(([, info]) => filters.eventIds.includes(info.eventId)).map(([id]) => id);
  }, [filters.sessionId, filters.eventIds, directory.sessions]);

  return (
    <>
      <PageHeader title="Khách hàng" description={organization.name} />

      <div className="grid gap-4">
        <StatsFilterBar
          organizationId={organization.id}
          filters={filters}
          resolved={resolved}
          onChange={update}
          onReset={reset}
          showBucket={false}
          showCompare={false}
        />

        {customers.isError ? (
          <ErrorState error={null} onRetry={() => void customers.refetch()} />
        ) : (
          <>
            {empty ? (
              <p className="m-0 rounded-nt border border-dashed border-border px-3 py-2 text-[13px] text-muted">
                Chưa có dữ liệu: không có đơn đã thanh toán nào trong khoảng thời gian và bộ lọc này.
              </p>
            ) : null}

            <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-4 ${customers.isPlaceholderData ? 'opacity-60' : ''}`}>
              <KpiCard
                label="Người mua"
                help={METRIC_HELP.buyers}
                loading={loading}
                value={empty || !data ? null : formatNumber(data.buyers)}
                hint={
                  data && !empty && paidOrders !== null
                    ? `${(paidOrders / data.buyers).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} đơn mỗi người`
                    : undefined
                }
                icon={<Users />}
              />
              <KpiCard
                label="Khách mới"
                help={METRIC_HELP.newBuyers}
                loading={loading}
                value={empty || !data ? null : formatNumber(data.newBuyers)}
                hint={data && !empty ? `${formatPercent(ratio(data.newBuyers, data.buyers), 1)} số người mua` : undefined}
                icon={<UserPlus />}
              />
              <KpiCard
                label="Khách quay lại"
                help={METRIC_HELP.returningBuyers}
                loading={loading}
                value={empty || !data ? null : formatNumber(data.returning)}
                hint={data && !empty ? `${formatPercent(ratio(data.returning, data.buyers), 1)} số người mua` : undefined}
                icon={<UserCheck />}
              />
              <KpiCard
                label="Mua lặp lại trong kỳ"
                help={METRIC_HELP.repeatBuyers}
                loading={loading}
                value={empty || !data ? null : formatNumber(data.repeatInPeriod)}
                hint={data && !empty ? `${formatPercent(ratio(data.repeatInPeriod, data.buyers), 1)} số người mua` : undefined}
                icon={<Repeat />}
              />
            </div>

            {empty || !data ? null : (
              <div className="grid gap-4 xl:grid-cols-2">
                <Panel>
                  <BarChart
                    caption="Khách mới và khách quay lại"
                    rows={[
                      {
                        key: 'new',
                        label: 'Khách mới',
                        value: data.newBuyers,
                        hint: `${formatPercent(ratio(data.newBuyers, data.buyers), 1)} số người mua trong kỳ`,
                      },
                      {
                        key: 'returning',
                        label: 'Khách quay lại',
                        value: data.returning,
                        hint: `${formatPercent(ratio(data.returning, data.buyers), 1)} số người mua trong kỳ`,
                      },
                    ]}
                    format={(value) => `${formatNumber(value)} người`}
                  />
                </Panel>
                <Panel>
                  <h2 className="m-0 mb-3 text-[14px] font-semibold">Số đơn mỗi người mua</h2>
                  <CountBarsChart caption="Số người mua theo số đơn đã thanh toán trong kỳ" valueName="Số người" rows={perBuyer} />
                </Panel>
              </div>
            )}
          </>
        )}

        <Section
          title="Xuất danh sách người mua"
          description="Tên người giữ vé theo từng vé, để đối chiếu khách ở cổng. Không có email hay số điện thoại."
        >
          <BuyerExportPanel
            organization={organization}
            sessionIds={exportScope}
            scopeLabel={
              filters.sessionId
                ? sessionText(directory.sessions, filters.sessionId)
                : filters.eventIds.length > 0
                  ? `${formatNumber(exportScope.length)} suất của ${formatNumber(filters.eventIds.length)} sự kiện đang chọn`
                  : 'mọi suất của tổ chức'
            }
            ready={!directory.loading}
            sessionName={(id) => sessionText(directory.sessions, id)}
          />
        </Section>
      </div>
    </>
  );
}

const TICKET_STATUS: Record<string, string> = { VALID: 'Chưa vào cửa', CHECKED_IN: 'Đã vào cửa' };

function BuyerExportPanel({
  organization,
  sessionIds,
  scopeLabel,
  ready,
  sessionName,
}: {
  organization: OrganizationSummary;
  sessionIds: string[];
  scopeLabel: string;
  ready: boolean;
  sessionName: (sessionId: string) => string;
}) {
  const canExport = useHasPermission('ORG_MEMBERS_MANAGE', organization.id);
  const exportBuyers = useExportBuyers(organization.id);
  const [done, setDone] = useState<string | null>(null);

  if (!canExport) {
    return (
      <Panel>
        <p className="m-0 text-[14px] text-muted">
          Chỉ chủ tổ chức và quản trị mới xuất được danh sách người mua. Tài khoản của bạn vẫn xem được mọi số liệu
          tổng hợp ở trên.
        </p>
      </Panel>
    );
  }

  function run() {
    setDone(null);
    exportBuyers.mutate(sessionIds, {
      onSuccess: (result) => {
        downloadCsv(
          csvFilename(['danh-sach-nguoi-mua']),
          toCsv([
            {
              title: 'DANH SÁCH NGƯỜI MUA',
              headers: ['Mục', 'Giá trị'],
              rows: [
                ['Tổ chức', organization.name],
                ['Phạm vi', scopeLabel],
                ['Xuất lúc', formatDateTime(result.exportedAt)],
                ['Số vé', result.rows.length],
                ['Ghi chú', 'Lượt xuất này đã được ghi vào nhật ký của tổ chức. Dữ liệu cá nhân — chỉ dùng cho việc soát khách.'],
              ],
            },
            {
              title: 'THEO VÉ',
              headers: ['Mã vé', 'Tên người giữ vé', 'Sự kiện · suất', 'Loại vé', 'Khu', 'Ghế', 'Trạng thái', 'Phát hành lúc'],
              rows: result.rows.map((row) => [
                row.ticketCode,
                row.holderName ?? '',
                sessionName(row.eventSessionId),
                row.ticketTypeName,
                row.zoneCode,
                row.seatLabel ?? '',
                TICKET_STATUS[row.status] ?? row.status,
                formatDateTime(row.issuedAt),
              ]),
            },
          ]),
        );
        setDone(`Đã xuất ${formatNumber(result.rows.length)} vé. Lượt xuất này đã được ghi vào Nhật ký.`);
      },
    });
  }

  return (
    <Panel>
      <div className="grid gap-3">
        <p className="m-0 flex items-start gap-2 text-[14px]">
          <ShieldCheck size={18} aria-hidden="true" className="mt-0.5 flex-none text-primary-text" />
          <span>
            File chứa <strong>tên đầy đủ</strong> của người giữ vé. Mỗi lần xuất được ghi vào Nhật ký của tổ chức kèm
            tên người xuất và số vé; nếu không ghi được nhật ký, hệ thống sẽ không cho xuất.
          </span>
        </p>
        <p className="m-0 text-[13px] text-muted">
          Phạm vi theo bộ lọc đang chọn: <strong className="text-ink">{scopeLabel}</strong>. Tối đa 20.000 vé mỗi lần.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={run} loading={exportBuyers.isPending} disabled={!ready}>
            <Download size={16} aria-hidden="true" /> Xuất CSV
          </Button>
          {/* `aria-live`: kết quả của một thao tác có hậu quả (ghi nhật ký) phải được đọc lên. */}
          <span aria-live="polite" className="text-[13px]">
            {exportBuyers.isError ? (
              <span className="text-danger-text">{exportError(exportBuyers.error)}</span>
            ) : done ? (
              <span className="text-success-text">{done}</span>
            ) : null}
          </span>
        </div>
      </div>
    </Panel>
  );
}

function exportError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'EXPORT_TOO_LARGE') return 'Danh sách vượt 20.000 vé. Hãy chọn một sự kiện hoặc một suất rồi xuất lại.';
    if (error.code === 'AUDIT_UNAVAILABLE') return 'Chưa ghi được nhật ký nên chưa thể xuất. Thử lại sau ít phút.';
    if (error.status === 403) return 'Tài khoản của bạn không có quyền xuất danh sách người mua.';
  }
  return 'Không xuất được danh sách. Thử lại sau ít phút.';
}
