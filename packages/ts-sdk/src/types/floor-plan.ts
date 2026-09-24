/**
 * Mặt bằng khán phòng.
 *
 * Nguồn: `FloorPlanViews` của catalog-service.
 *
 * ## Đơn vị là "ghế", không phải pixel
 *
 * Một đơn vị = khoảng cách giữa hai ghế cạnh nhau. Backend cố ý không gửi pixel: cùng một sơ đồ
 * được vẽ trên điện thoại 360px, trên màn hình quản trị 1600px và trong ảnh poster 2480px. Cách
 * dùng là đặt thẳng `bounds` vào `viewBox` của SVG rồi để trình duyệt lo phần co giãn — đừng nhân
 * với một hệ số tự chọn ở client.
 *
 * ## Hai phép chiếu, một phép tính
 *
 * - Đường công khai (`GET /v1/events/{slug}/floor-plan`) trả `zones[].seats` **rỗng**. Toạ độ từng
 *   ghế đã nằm trong sơ đồ tồn kho (`Seat.posX/posY`) kèm trạng thái còn/hết; trả lần thứ hai ở
 *   đây là gửi 5.000 dòng mà không thêm thông tin gì.
 * - Đường quản trị (`GET /v1/organizations/{id}/venues/{id}/floor-plan`) **có** ghế, vì ban tổ chức
 *   xem trước sơ đồ khi inventory chưa dựng ghế nào.
 *
 * Nối hai nguồn theo `seatCode` — đó là khoá chung giữa catalog và inventory.
 */

export type StageShape = 'RECTANGLE' | 'CIRCLE' | 'THRUST';

export type LayoutShape = 'GRID' | 'ARC';

/** `height` đã được backend giải sẵn: sân khấu tròn trả đường kính, không trả 0. */
export interface FloorPlanStage {
  shape: StageShape;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FloorPlanPoint {
  x: number;
  y: number;
}

export interface FloorPlanSeat {
  /** Khoá nối sang `Seat.seatCode` của inventory. */
  seatCode: string;
  row: number;
  seat: number;
  x: number;
  y: number;
}

export interface FloorPlanZone {
  zoneCode: string;
  name: string;
  kind: 'SEATED' | 'STANDING';
  seatCount: number;
  layoutShape: LayoutShape;
  /** Đa giác bao khu; điểm cuối nối về điểm đầu là ngầm định. */
  outline: FloorPlanPoint[];
  /** Rỗng ở đường công khai — xem ghi chú đầu file. */
  seats: FloorPlanSeat[];
}

/** Bao hình của cả mặt bằng, đã gồm sân khấu. Đặt thẳng vào `viewBox`. */
export interface FloorPlanBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface FloorPlan {
  venueId: string;
  venueName: string;
  stage: FloorPlanStage;
  zones: FloorPlanZone[];
  bounds: FloorPlanBounds;
}

/** Khung nhìn ở dạng số — cái mà thao tác kéo và phóng làm việc trên đó. */
export interface FloorPlanRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Bao hình cộng một lề.
 *
 * Lề tính theo đơn vị mặt bằng chứ không theo pixel — nới bằng pixel thì cùng một lề sẽ nuốt mất
 * nửa khán phòng nhỏ và không thấy được ở khán phòng lớn.
 */
export function floorPlanRect(bounds: FloorPlanBounds, padding = 2): FloorPlanRect {
  return {
    x: bounds.minX - padding,
    y: bounds.minY - padding,
    width: bounds.maxX - bounds.minX + padding * 2,
    height: bounds.maxY - bounds.minY + padding * 2,
  };
}

/** Thuộc tính `viewBox` của SVG. */
export function floorPlanViewBox(rect: FloorPlanRect): string {
  return `${rect.x} ${rect.y} ${rect.width} ${rect.height}`;
}

/** `M x y L x y … Z` từ đường bao của một khu. */
export function outlinePath(outline: FloorPlanPoint[]): string {
  const first = outline[0];
  if (!first) return '';
  const rest = outline
    .slice(1)
    .map((p) => `L ${p.x} ${p.y}`)
    .join(' ');
  return `M ${first.x} ${first.y} ${rest} Z`;
}
