/**
 * Hợp đồng của `analytics-service`.
 *
 * Nguồn: `SalesDashboardController`, `SalesQueries.OrganizationSummary`.
 *
 * Chỉ có số vé và số tiền đã bán. Không có hoa hồng, số dư hay lịch chi trả — đó là ranh giới
 * cứng giữa miền của ban tổ chức và miền tài chính của superadmin (ADR-1010). Đừng thêm vào đây.
 */

export interface SessionSales {
  eventSessionId: string;
  eventId: string;
  ticketsSold: number;
  grossVnd: number;
  ordersPaid: number;
  ordersExpired: number;
  ordersCancelled: number;
}

export interface OrganizationSales {
  organizationId: string;
  totalTicketsSold: number;
  totalGrossVnd: number;
  sessions: SessionSales[];
}
