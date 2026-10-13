/**
 * Thống kê của ban tổ chức.
 *
 * Ba nguồn, ba câu hỏi khác nhau:
 * - `orders` (ordering-service): bán hàng THEO KỲ. Đơn thuộc về kỳ theo thời điểm đặt; doanh thu
 *   là tổng tiền các đơn đã thanh toán.
 * - `inventory` (inventory-service): tồn kho HIỆN TẠI — sức chứa, đã bán, đang giữ.
 * - `checkins` (ticketing-service): hiện diện HIỆN TẠI — đã đến, đang ở trong.
 *
 * Không có hoa hồng, phí hay số dư ở đây: đó là miền tài chính của nền tảng (ADR-1010).
 */

export type StatsBucket = 'hour' | 'day' | 'week';

/** Bộ lọc gửi lên server. `from`/`to` là ngày địa phương `YYYY-MM-DD`, hai đầu đều tính. */
export interface SalesStatsParams {
  from: string;
  to: string;
  eventIds?: string[];
  sessionIds?: string[];
  ticketTypeIds?: string[];
}

export interface StatsPeriod {
  from: string;
  to: string;
}

export interface SalesTotals {
  ordersTotal: number;
  ordersPaid: number;
  ordersAwaiting: number;
  ordersExpired: number;
  ordersCancelled: number;
  /** Đơn ngoài bốn nhánh của phễu: đang đối soát tay, đã hoàn. */
  ordersOther: number;
  grossVnd: number;
  ticketsSold: number;
  /** `null` khi kỳ không có đơn nào được trả. */
  avgSecondsToPay: number | null;
  buyers: number;
}

export interface SalesSummary {
  period: StatsPeriod;
  current: SalesTotals;
  previousPeriod: StatsPeriod | null;
  previous: SalesTotals | null;
}

export interface SalesPoint {
  /** Đầu ô, giờ Việt Nam, dạng `2026-10-13T00:00:00` (không có múi giờ). */
  bucket: string;
  grossVnd: number;
  ticketsSold: number;
  ordersCreated: number;
  ordersPaid: number;
  ordersExpired: number;
  ordersCancelled: number;
}

export interface SalesSeries {
  bucket: StatsBucket;
  period: StatsPeriod;
  current: SalesPoint[];
  previousPeriod: StatsPeriod | null;
  previous: SalesPoint[] | null;
}

export interface SalesSessionRow {
  eventId: string;
  eventSessionId: string;
  ticketsSold: number;
  grossVnd: number;
  ordersTotal: number;
  ordersPaid: number;
  ordersAwaiting: number;
  ordersExpired: number;
  ordersCancelled: number;
}

export interface SalesTicketTypeRow {
  eventId: string;
  eventSessionId: string;
  ticketTypeId: string;
  ticketTypeName: string;
  unitPriceVnd: number;
  ticketsSold: number;
  grossVnd: number;
}

export interface SalesBreakdown {
  period: StatsPeriod;
  sessions: SalesSessionRow[];
  ticketTypes: SalesTicketTypeRow[];
}

export interface SalesHeatCell {
  /** 1 = thứ Hai … 7 = Chủ nhật. */
  dayOfWeek: number;
  hour: number;
  grossVnd: number;
  ordersPaid: number;
}

export interface SalesHeatmap {
  period: StatsPeriod;
  cells: SalesHeatCell[];
}

export interface TicketTypeStock {
  eventId: string;
  eventSessionId: string;
  ticketTypeId: string;
  ticketTypeName: string;
  priceVnd: number;
  /** Tổng số chỗ đã dựng, gồm cả chỗ bị khoá. */
  capacity: number;
  sold: number;
  /** Đang trong giỏ hoặc đang chờ thanh toán. */
  held: number;
  available: number;
  blocked: number;
}

export interface InventoryStock {
  ticketTypes: TicketTypeStock[];
  expiringHolds: { eventSessionId: string; seats: number }[];
  expiringWithinMinutes: number;
}

export interface SessionPresence {
  eventSessionId: string;
  ticketsIssued: number;
  /** Vé đã vào cửa ít nhất một lần. */
  arrived: number;
  inside: number;
  /** Tổng số lần vào, gồm cả vào lại. */
  entries: number;
}

export interface GatePresence {
  sessions: SessionPresence[];
}

export interface StatsSession {
  eventSessionId: string;
  eventId: string;
  eventTitle: string;
  eventStatus: string;
  startsAt: string;
  endsAt: string | null;
}

export interface SalesDistribution {
  period: StatsPeriod;
  /** Số đơn đã trả có đúng `tickets` vé. */
  ticketsPerOrder: { tickets: number; orders: number }[];
}

export type StatsOrderStatus =
  | 'AWAITING_PAYMENT'
  | 'PAID'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'MANUAL_REVIEW';

export interface StatsOrderRow {
  orderId: string;
  orderNumber: string;
  eventId: string;
  eventSessionId: string;
  status: StatsOrderStatus;
  tickets: number;
  totalVnd: number;
  createdAt: string;
  paidAt: string | null;
}

export interface StatsOrderPage {
  period: StatsPeriod;
  rows: StatsOrderRow[];
  /** Tổng số đơn khớp bộ lọc, không phải số dòng của trang này. */
  total: number;
  page: number;
  size: number;
}

export interface StatsOrderListParams extends SalesStatsParams {
  statuses?: StatsOrderStatus[];
  query?: string;
  page: number;
  size: number;
}

export interface GateLogTotals {
  scans: number;
  /** Lượt vào được chấp nhận, gồm cả vào lại. */
  entries: number;
  uniqueTickets: number;
  exits: number;
  rejected: number;
}

export interface GateSessionFlow {
  eventSessionId: string;
  entries: number;
  uniqueTickets: number;
  exits: number;
  rejected: number;
  /** Ba mốc tính trên lần vào ĐẦU TIÊN của mỗi vé. */
  firstEntryAt: string | null;
  lastEntryAt: string | null;
  averageEntryAt: string | null;
}

export interface GateScannerRow {
  userId: string;
  scans: number;
  accepted: number;
  rejected: number;
  exits: number;
  overrides: number;
  /** Số phút có ít nhất một lượt quét. */
  activeMinutes: number;
  firstScanAt: string | null;
  lastScanAt: string | null;
}

export interface GateRow {
  gate: string | null;
  scans: number;
  accepted: number;
  rejected: number;
  exits: number;
}

export interface GateOverride {
  eventSessionId: string;
  scannedBy: string;
  scannedAt: string;
  gate: string | null;
  reason: string | null;
  ticketCode: string | null;
}

export interface GateActivity {
  from: string;
  to: string;
  totals: GateLogTotals;
  rejectedByReason: { key: string; count: number }[];
  entriesByMethod: { key: string; count: number }[];
  sessions: GateSessionFlow[];
  scanners: GateScannerRow[];
  gates: GateRow[];
  overrides: GateOverride[];
  /** Ô 15 phút có hoạt động; `bucket` là giờ Việt Nam không kèm múi giờ. */
  timeline: { bucket: string; entries: number; exits: number; rejected: number }[];
  timelineTruncated: boolean;
}

export interface OrderBuyers {
  /** Tên đã che bớt ở server ("Nguyễn V. A."); đơn chưa phát vé thì không có mặt. */
  buyers: { orderId: string; name: string | null }[];
}

export interface SalesCustomers {
  period: StatsPeriod;
  /** Người có ít nhất một đơn đã trả trong kỳ. */
  buyers: number;
  newBuyers: number;
  /** Đã có đơn đã trả ở tổ chức này TRƯỚC kỳ. */
  returning: number;
  /** Có từ hai đơn đã trả trở lên ngay trong kỳ. */
  repeatInPeriod: number;
  /** `tickets` ở đây là SỐ ĐƠN đã trả của một người (5 = từ 5 trở lên); `orders` là số người. */
  ordersPerBuyer: { tickets: number; orders: number }[];
}

export interface GateNoShows {
  rows: { eventSessionId: string; ticketTypeName: string; tickets: number }[];
}

/** Một dòng của danh sách người mua xuất ra — có TÊN ĐẦY ĐỦ; mỗi lượt xuất được ghi nhật ký. */
export interface BuyerExportRow {
  ticketCode: string;
  holderName: string | null;
  eventSessionId: string;
  ticketTypeName: string;
  zoneCode: string;
  seatLabel: string | null;
  status: string;
  issuedAt: string;
}

export interface BuyerExport {
  rows: BuyerExportRow[];
  exportedAt: string;
}
