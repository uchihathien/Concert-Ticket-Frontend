/**
 * Hợp đồng của `ledger-service` — chỉ superadmin (ADR-1010).
 *
 * Nguồn: `PlatformLedgerController`, `LedgerQueries`.
 */

export interface TrialBalance {
  totalDebitVnd: number;
  totalCreditVnd: number;
  /**
   * `false` là sự cố nghiêm trọng: sổ cái đã sai và mọi con số phái sinh đều không tin được.
   * Màn P-LEDGER phải hiện cảnh báo đỏ chứ không lẳng lặng vẽ bảng.
   */
  balanced: boolean;
}

export interface OrganizationBalance {
  organizationId: string;
  /** Đã thu nhưng chưa tới hạn rút. */
  heldVnd: number;
  /** Số dư khả dụng — con số tổ chức thật sự rút được. */
  availableVnd: number;
  /** Phần giữ lại phòng khách đòi hoàn. */
  refundReserveVnd: number;
  /** Đã giữ chỗ để chi trả, ngân hàng chưa xác nhận. */
  inTransitVnd: number;
}
