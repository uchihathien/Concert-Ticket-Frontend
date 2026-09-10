'use client';

import {
  ApiError,
  useAdminEvents,
  useOrganizationSales,
  type OrganizationSummary,
  type SessionSales,
} from '@nexaticket/ts-sdk';
import {
  EmptyState,
  ErrorState,
  MoneyText,
  PageHeader,
  Panel,
  Skeleton,
  Table,
  formatNumber,
} from '@nexaticket/ui';
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

  const titleOf = new Map((events.data ?? []).map((event) => [event.id, event.title]));
  const rows = [...sales.data.sessions].sort((a, b) => b.grossVnd - a.grossVnd);

  return (
    <>
      <PageHeader title="Doanh thu" description={organization.name} />

      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <Stat label="Vé đã bán" value={formatNumber(sales.data.totalTicketsSold)} />
          <Stat
            label="Doanh thu"
            value={<MoneyText amountVnd={sales.data.totalGrossVnd} strong />}
          />
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title="Chưa bán được vé nào"
            description="Số liệu xuất hiện ở đây sau đơn hàng đầu tiên được thanh toán."
          />
        ) : (
          <Panel>
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
          </Panel>
        )}
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Panel>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--nt-text-muted)' }}>{label}</p>
      <p style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 700 }}>{value}</p>
    </Panel>
  );
}

/**
 * Màn lỗi riêng cho trang này.
 *
 * Tách khỏi `ErrorState` chung vì ở đây lỗi gần như chắc chắn là **thiếu hạ tầng**, không phải
 * mạng chập chờn: tới thời điểm viết, `analytics-service` (cổng 8099) chưa chạy và `api-gateway`
 * chưa khai route `/v1/admin/**`. Hiện "Có lỗi xảy ra, thử lại" ở đây là để người dùng bấm Thử
 * lại mãi mãi.
 *
 * Cả hai đều là thay đổi phía backend, cần người xử lý — nên nói thẳng ra là thiếu gì.
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
      <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>Chưa kết nối được dịch vụ thống kê</h2>
      <p style={{ margin: '0 0 8px', color: 'var(--nt-text-muted)' }}>
        Màn hình này đọc <code>GET /v1/admin/organizations/{'{id}'}/sales</code> của
        analytics-service. Hiện đường đi chưa thông, nên đây là vấn đề hạ tầng chứ không phải tổ
        chức của bạn chưa có doanh thu.
      </p>
      <ul style={{ margin: '0 0 12px', paddingInlineStart: 20, color: 'var(--nt-text-muted)' }}>
        <li>analytics-service (cổng 8099) cần được khởi động.</li>
        <li>
          api-gateway cần thêm route cho <code>/v1/admin/**</code> — hiện bảng route chưa có mẫu nào
          khớp.
        </li>
      </ul>
      {apiError?.correlationId ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--nt-text-muted)' }}>
          Mã tra cứu: {apiError.correlationId}
        </p>
      ) : null}
    </Panel>
  );
}
