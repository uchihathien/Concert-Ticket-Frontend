'use client';

import { ApiError, useTrialBalance } from '@nexaticket/ts-sdk';
import { Badge, ErrorState, MoneyText, PageHeader, Panel, Skeleton } from '@nexaticket/ui';
import { ScaleIcon } from 'lucide-react';

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
          <div className="grid gap-5">
            {/* Cân bằng là điều kiện sống còn, nên nó đứng đầu chứ không nằm cuối bảng. */}
            <div className="flex items-center gap-3">
              <ScaleIcon
                size={20}
                aria-hidden="true"
                className={trialBalance.data.balanced ? 'text-success' : 'text-danger'}
              />
              <Badge tone={trialBalance.data.balanced ? 'success' : 'danger'}>
                {trialBalance.data.balanced ? 'Cân bằng' : 'LỆCH — cần xử lý ngay'}
              </Badge>
            </div>

            {/* Hai vế nợ/có nằm cạnh nhau trên desktop để mắt so được ngay; dưới 640px thì xuống
                hàng — hai con số tiền bị bóp trên một dòng hẹp là hai con số không đọc nổi. */}
            <dl className="m-0 grid gap-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted">Tổng nợ</dt>
                <dd className="m-0 mt-1 text-[22px]">
                  <MoneyText amountVnd={trialBalance.data.totalDebitVnd} strong />
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Tổng có</dt>
                <dd className="m-0 mt-1 text-[22px]">
                  <MoneyText amountVnd={trialBalance.data.totalCreditVnd} strong />
                </dd>
              </div>
            </dl>
          </div>
        </Panel>
      )}
    </>
  );
}
