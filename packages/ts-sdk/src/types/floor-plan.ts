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

export type LayoutShape = 'GRID' | 'ARC' | 'TABLE';

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

/**
 * Bố cục **đã giải** của một khu.
 *
 * Khác `ZoneLayoutInput` ở một điểm quyết định: nó không bao giờ rỗng. Khu chưa đặt vị trí vẫn có
 * một chỗ đứng sau khi bố cục tự động chạy xong, và đây là thứ trình sửa sơ đồ cần để ghim khu ấy
 * tại đúng chỗ nó đang đứng ngay lần kéo đầu tiên.
 */
export interface ResolvedZoneLayout {
  shape: LayoutShape;
  originX: number;
  originY: number;
  /** Có với `GRID` và `TABLE` (xoay cả khối bàn). */
  rotationDeg: number | null;
  /** `innerRadius` có với `ARC` (bán kính hàng đầu) và `TABLE` (bán kính bàn); hai góc chỉ có với `ARC`. */
  innerRadius: number | null;
  startAngleDeg: number | null;
  endAngleDeg: number | null;
}

export interface FloorPlanZone {
  zoneCode: string;
  name: string;
  kind: 'SEATED' | 'STANDING';
  seatCount: number;
  layoutShape: LayoutShape;
  layout: ResolvedZoneLayout;
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

/**
 * Toạ độ ghế có nằm đúng chỗ trên mặt bằng này không.
 *
 * Câu hỏi nghe thừa, nhưng nó có thật và đã hỏng: toạ độ ghế do inventory giữ, được chốt lúc suất
 * diễn được publish. Những suất publish trước khi catalog biết tính hình học đã chốt **chỉ số hàng
 * và cột** (1…26, 1…18) thay vì toạ độ mét trên mặt bằng — và tồn kho thì không dựng lại được nếu
 * không rút sự kiện xuống. Trên dữ liệu thật của hệ thống này, 52 trên 63 suất đang như vậy.
 *
 * Vẽ chúng bằng `SeatMapCanvas` cho ra một sơ đồ sai một cách khó nhận ra: ghế của cả ba khu chồng
 * lên nhau ở một góc, và những ghế rơi ra ngoài khung nhìn thì **biến mất** vì phép cắt theo khung.
 * Khách thấy một khán phòng thiếu quá nửa số chỗ, không có lỗi nào được báo.
 *
 * Nên trước khi vẽ phải hỏi câu này, và trả lời "không" thì rơi về cách hiển thị khác.
 *
 * Phép đo là **đường bao từng khu**, không phải bao hình cả mặt bằng: dữ liệu chỉ số ngẫu nhiên
 * trùng vào bao hình chung rất dễ (khán phòng nào chẳng có toạ độ 1…20), nhưng trùng vào đúng khu
 * của mình thì không — khu B nằm ở y 23…37 mà ghế của nó mang y 1…10 là lộ ngay.
 *
 * @param tolerance phần ghế được phép nằm ngoài khu của mình. Không đặt 0: khu hình cung đặt ghế
 *   theo cung tròn, và vài ghế mép có thể nhô khỏi đa giác bao do làm tròn.
 */
export function seatPositionsFitFloorPlan(
  floorPlan: FloorPlan,
  positions: Map<string, FloorPlanPoint>,
  tolerance = 0.1,
): boolean {
  if (positions.size === 0) return false;

  for (const zone of floorPlan.zones) {
    if (zone.outline.length === 0) continue;

    const box = boundingBox(zone.outline);
    let total = 0;
    let outside = 0;

    for (const [seatCode, at] of positions) {
      // Cùng quy ước với `SeatMapCanvas`: mã chỗ mở đầu bằng mã khu.
      if (!seatCode.startsWith(`${zone.zoneCode}-`)) continue;
      total += 1;
      if (at.x < box.minX || at.x > box.maxX || at.y < box.minY || at.y > box.maxY) outside += 1;
    }

    if (total > 0 && outside / total > tolerance) return false;
  }

  return true;
}

function boundingBox(outline: FloorPlanPoint[]): FloorPlanBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of outline) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }
  return { minX, minY, maxX, maxY };
}
