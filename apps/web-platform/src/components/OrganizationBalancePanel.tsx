'use client';

import { ApiError, useOrganizationBalance } from '@nexaticket/ts-sdk';
import { ErrorState, MoneyText, Panel, Section, Skeleton } from '@nexaticket/ui';

/**
 * Số dư của một tổ chức trên sổ cái — `GET /v1/platform/organizations/{id}/balance`.
 *
 * Chỉ đọc. Bốn ô là bốn tài khoản backend tách riêng; màn này không cộng chúng thành một "tổng"
 * vì cộng tiền đang giữ với tiền khả dụng ra một con số không ai rút được.
 *
 * Lỗi (kể cả 404 khi ledger-service chưa chạy) hiện đúng lỗi từ server, kèm thử lại — không vẽ
 * bốn số 0, vì "chưa có tiền" và "không đọc được sổ" là hai câu khác hẳn nhau.
 */
export function OrganizationBalancePanel({ organizationId }: { organizationId: string }) {
  const balance = useOrganizationBalance(organizationId);

  return (
    <Section
      title="Số dư trên sổ cái"
      description="Đọc từ ledger-service. Chỉ để đối soát — màn này không chuyển tiền."
    >
      {balance.isPending ? (
        <Panel>
          <Skeleton lines={2} />
        </Panel>
      ) : balance.isError ? (
        <ErrorState
          error={balance.error instanceof ApiError ? balance.error : null}
          correlationId={balance.error instanceof ApiError ? balance.error.correlationId : null}
          onRetry={() => void balance.refetch()}
        />
      ) : (
        <Panel>
          {/* Hai cột trên màn hẹp, bốn cột từ 1024px: bốn số tiền chen một dòng hẹp là bốn số
              không đọc nổi. */}
          <dl className="m-0 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <BalanceItem
              label="Khả dụng"
              hint="Phần tổ chức thật sự rút được."
              amountVnd={balance.data.availableVnd}
              strong
            />
            <BalanceItem
              label="Đang giữ"
              hint="Đã thu, chưa tới hạn rút."
              amountVnd={balance.data.heldVnd}
            />
            <BalanceItem
              label="Dự phòng hoàn tiền"
              hint="Giữ lại phòng khách đòi hoàn."
              amountVnd={balance.data.refundReserveVnd}
            />
            <BalanceItem
              label="Đang chuyển"
              hint="Đã giữ để chi trả, ngân hàng chưa xác nhận."
              amountVnd={balance.data.inTransitVnd}
            />
          </dl>
        </Panel>
      )}
    </Section>
  );
}

function BalanceItem({
  label,
  hint,
  amountVnd,
  strong = false,
}: {
  label: string;
  hint: string;
  amountVnd: number;
  strong?: boolean;
}) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="m-0 mt-1 text-[20px]">
        <MoneyText amountVnd={amountVnd} strong={strong} />
      </dd>
      <dd className="m-0 mt-1 text-[12px] text-muted">{hint}</dd>
    </div>
  );
}
