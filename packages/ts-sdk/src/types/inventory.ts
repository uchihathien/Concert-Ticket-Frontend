/**
 * Hợp đồng của `inventory-service`.
 *
 * Nguồn: `SeatMapController`, `SeatMapView`, `HoldController`.
 */

/**
 * `SeatStatus` của backend — đúng năm giá trị này, không hơn.
 *
 * Chú ý: API **không** phân biệt "ghế bạn đang giữ" với "ghế người khác giữ"; cả hai đều là
 * `HELD`. Trạng thái "của tôi" mà ui-direction.md §6 đòi phải suy ra ở client từ ghế đang chọn và
 * từ `HoldCreated.seatIds` của chính mình.
 */
export type SeatStatus = 'AVAILABLE' | 'HELD' | 'RESERVED' | 'SOLD' | 'BLOCKED';

export interface Seat {
  id: string;
  seatCode: string;
  zoneCode: string;
  sectionLabel: string | null;
  rowLabel: string | null;
  seatLabel: string | null;
  /** Toạ độ trong hệ của mặt bằng; backend trả BigDecimal, JSON hoá thành số. */
  posX: number | null;
  posY: number | null;
  ticketTypeId: string | null;
  ticketTypeName: string | null;
  priceVnd: number;
  status: SeatStatus;
}

/** Vé đứng gộp theo zone — backend cố ý không trả từng đơn vị (ADR-1012). */
export interface StandingZone {
  zoneCode: string;
  ticketTypeId: string | null;
  ticketTypeName: string | null;
  priceVnd: number;
  available: number;
  capacity: number;
}

/** Chỉ có khi đã đăng nhập. Khách vãng lai vẫn xem được sơ đồ, chỉ không thấy hạn mức. */
export interface PurchaseAllowance {
  limit: number;
  used: number;
  remaining: number;
}

export interface SeatMap {
  eventSessionId: string;
  /** Tăng mỗi lần tồn kho đổi. Delta WebSocket cũ hơn số này thì bỏ qua. */
  availabilityVersion: number;
  seats: Seat[];
  standingZones: StandingZone[];
  purchaseAllowance: PurchaseAllowance | null;
}

export interface StandingLine {
  zoneCode: string;
  quantity: number;
}

export interface PlaceHoldRequest {
  /** Ghế khách chỉ đích danh. Bỏ trống nếu chỉ mua vé đứng. */
  seatIds?: string[];
  standing?: StandingLine[];
}

export interface HoldCreated {
  holdId: string;
  /** ISO-8601. Mốc tuyệt đối để đếm ngược — đừng tự cộng 5 phút ở client. */
  expiresAt: string;
  seatIds: string[];
  availabilityVersion: number;
}
