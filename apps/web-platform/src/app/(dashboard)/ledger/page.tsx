'use client';

import { ApiError, useTrialBalance } from '@nexaticket/ts-sdk';
import { Badge, ErrorState, MoneyText, PageHeader, Panel, Skeleton } from '@nexaticket/ui';

/**
 * P-LEDGER — bảng cân đối thử.
 *
 * **Chưa gọi được qua gateway.** `api-gateway/application.yml` hiện chưa có route nào trỏ tới
 * ledger-service, nên `/v1/platform/trial-balance` trả 404. Màn này dựng sẵn và sẽ chạy ngay khi
 * backend thêm route; tới lúc đó nó hiện đúng lỗi từ server thay vì một trang trắng.
 *
 * Còn một va chạm nữa cần backend xử lý: `/v1/platform/organizations/{id}/balance` của ledger
 * trùng tiền tố `/v1/platform/organizations/**` vốn đang trỏ về identity.
 */
export default function LedgerPage() {
  const trialBalance = useTrialBalance();

  return (
    <>
      <PageHeader
        title="Sổ cái"
        description="Bảng cân đối thử của toàn nền tảng. Lệch nghĩa là sổ đã sai và mọi con số phái sinh đều không tin được."
      />

      {trialBalance.isPending ? (
        <Panel>
          <Skeleton lines={3} />
        </Panel>
      ) : trialBalance.isError ? (
        <ErrorState
          error={trialBalance.error instanceof ApiError ? trialBalance.error : null}
          correlationId={
            trialBalance.error instanceof ApiError ? trialBalance.error.correlationId : null
          }
          onRetry={() => void trialBalance.refetch()}
        />
      ) : (
        <Panel>
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Cân bằng là điều kiện sống còn, nên nó đứng đầu chứ không nằm cuối bảng. */}
              <Badge tone={trialBalance.data.balanced ? 'success' : 'danger'}>
                {trialBalance.data.balanced ? 'Cân bằng' : 'LỆCH — cần xử lý ngay'}
              </Badge>
            </div>
            <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
              <div>
                <p style={{ margin: 0, color: 'var(--nt-text-muted)', fontSize: 14 }}>Tổng nợ</p>
                <p style={{ margin: 0, fontSize: 22 }}>
                  <MoneyText amountVnd={trialBalance.data.totalDebitVnd} strong />
                </p>
              </div>
              <div>
                <p style={{ margin: 0, color: 'var(--nt-text-muted)', fontSize: 14 }}>Tổng có</p>
                <p style={{ margin: 0, fontSize: 22 }}>
                  <MoneyText amountVnd={trialBalance.data.totalCreditVnd} strong />
                </p>
              </div>
            </div>
          </div>
        </Panel>
      )}
    </>
  );
}
