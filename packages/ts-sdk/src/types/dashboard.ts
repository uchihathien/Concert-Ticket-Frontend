/**
 * Bảng điều khiển của ban tổ chức.
 *
 * Nguồn: `OrganizationDashboardController` + `DashboardViews` của catalog-service.
 *
 * ## `degraded` không phải chi tiết kỹ thuật thừa
 *
 * Màn hình này ghép dữ liệu của **ba** service: catalog (sự kiện, khu, hạng vé), inventory (trạng
 * thái từng chỗ) và analytics (vé bán, doanh thu). Backend cố ý trả 200 kèm phần còn lại khi một
 * service im lặng, thay vì 500 cho cả trang.
 *
 * Hệ quả bắt buộc phải xử lý ở giao diện: `grossVnd: 0` có **hai** nghĩa khác hẳn nhau — "chưa bán
 * được đồng nào" và "không hỏi được doanh thu". Chúng chỉ phân biệt được bằng `degraded`. Hiện
 * "0đ" cho trường hợp thứ hai là báo sai cho ban tổ chức về chính tiền của họ, nên mọi con số đến
 * từ một service có tên trong `degraded` phải hiện là "—", không phải "0".
 */

import type { SessionSales as AnalyticsSessionSales } from './analytics';
import type { AdminEventDetail, AdminEventRow } from './catalog';

/** @see DashboardViews.DashboardTotals */
export interface DashboardTotals {
  eventCount: number;
  publishedCount: number;
  draftCount: number;
  /** Tổng sức chứa đã khai của mọi sự kiện, kể cả bản nháp. */
  capacity: number;
  ticketsSold: number;
  /** Tổng khách trả, KHÔNG phải số tổ chức sẽ nhận (ADR-1010). */
  grossVnd: number;
}

/**
 * Số bán của MỘT sự kiện.
 *
 * Danh sách rời khỏi `events` chứ không nhét hai cột vào `AdminEventRow`: kiểu đó là view chung của
 * cả khu quản trị, và thêm hai trường chỉ một màn hình cần sẽ buộc mọi đường đọc khác điền chúng —
 * hoặc điền 0, tức là nói sai.
 *
 * @param grossVnd tổng khách trả, KHÔNG phải số tổ chức sẽ nhận (ADR-1010)
 */
export interface EventSales {
  eventId: string;
  ticketsSold: number;
  grossVnd: number;
}

export interface OrganizationDashboard {
  organizationId: string;
  totals: DashboardTotals;
  events: AdminEventRow[];
  /**
   * Số bán theo từng sự kiện. **Rỗng khi analytics im lặng** — đọc cùng `degraded`, vì một danh
   * sách rỗng không có nghĩa là chưa bán được gì.
   */
  eventSales: EventSales[];
  /** Tên service không hỏi được ở lần dựng này. Rỗng nghĩa là mọi con số đều đáng tin. */
  degraded: string[];
}

export interface SeatCounts {
  available: number;
  held: number;
  reserved: number;
  sold: number;
  blocked: number;
  total: number;
}

export interface ZoneSeatCounts extends SeatCounts {
  zoneCode: string;
  admissionType: string;
}

export interface SessionSeating {
  /** Số liệu này ứng với lần thay đổi tồn kho nào. */
  availabilityVersion: number;
  totals: SeatCounts;
  zones: ZoneSeatCounts[];
}

/**
 * Số bán của một suất, như bảng điều khiển nhận.
 *
 * Dùng lại kiểu của analytics chứ không khai một interface song song — đây đúng là dữ liệu ấy,
 * chỉ khác đường đi: catalog hỏi analytics rồi ghép vào cùng một payload. Hai khai báo giống nhau
 * là hai chỗ để lệch khi analytics thêm một cột.
 *
 * Bỏ `eventSessionId` và `eventId`: ở đây chúng đã nằm ở `SessionReport` bao ngoài, và hai bản sao
 * trong một payload là hai bản sẽ lệch.
 */
export type SessionSalesReport = Omit<AnalyticsSessionSales, 'eventSessionId' | 'eventId'>;

/**
 * @param seating `null` khi suất chưa dựng tồn kho (sự kiện còn nháp) **hoặc** inventory không
 *   trả lời. Phân biệt hai trường hợp bằng `degraded` của bản ghi bao ngoài.
 */
export interface SessionReport {
  eventSessionId: string;
  startsAt: string;
  seating: SessionSeating | null;
  sales: SessionSalesReport | null;
}

/**
 * @param materializedSeats số chỗ thật sự đã dựng ở inventory. Lệch với `declaredCapacity` nghĩa
 *   là sơ đồ đã đổi sau lần publish gần nhất — đáng để mắt, không phải lỗi.
 */
export interface MasterDataTotals {
  declaredCapacity: number;
  materializedSeats: number;
  seatsSold: number;
  ticketsSold: number;
  grossVnd: number;
}

export interface EventMasterData {
  event: AdminEventDetail;
  sessions: SessionReport[];
  totals: MasterDataTotals;
  degraded: string[];
}
