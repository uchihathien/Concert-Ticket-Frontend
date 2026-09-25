/**
 * Khai báo sơ đồ khán phòng.
 *
 * Nguồn: `OrganizationSeatingController` của catalog-service.
 *
 * ## Đơn vị là "ghế", không phải pixel
 *
 * Một đơn vị = khoảng cách giữa hai ghế cạnh nhau. Cùng một sơ đồ được vẽ trên điện thoại 360px,
 * màn quản trị 1600px và ảnh poster 2480px — con số duy nhất đúng ở cả ba chỗ là con số không
 * mang đơn vị hiển thị nào.
 *
 * ## Frontend KHÔNG tự tính toạ độ ghế
 *
 * Trình sửa sơ đồ gửi cả bản nháp lên `…/floor-plan/preview` và nhận về mặt bằng đã giải. Chép
 * công thức sang TypeScript sẽ tạo bản cài đặt thứ hai của cùng phép tính, và bản lệch là bản ban
 * tổ chức nhìn thấy lúc quyết định.
 */

import type { LayoutShape, StageShape } from './floor-plan';

/** `height` bị bỏ qua với `CIRCLE` — sân khấu tròn lấy `width` làm đường kính. */
export interface StageInput {
  shape: StageShape;
  x: number;
  y: number;
  width: number;
  height?: number;
}

/**
 * Vị trí một khu trên mặt bằng.
 *
 * `rotationDeg` chỉ có nghĩa với `GRID`; ba trường cung chỉ có nghĩa với `ARC`. Backend bỏ qua
 * trường không thuộc hình đang chọn, nên gửi thừa không sao — nhưng gửi thiếu với `ARC` thì bị
 * từ chối (`ZONE_LAYOUT_INVALID`).
 */
export interface ZoneLayoutInput {
  shape: LayoutShape;
  originX: number;
  originY: number;
  rotationDeg?: number;
  innerRadius?: number;
  /** Độ. 0° là hướng +x, góc tăng theo chiều kim đồng hồ (trục y hướng xuống, quy ước SVG). */
  startAngleDeg?: number;
  endAngleDeg?: number;
}

/**
 * Một khu trong bản khai.
 *
 * Khu ngồi khai `rowCount` × `seatsPerRow`; khu đứng khai `capacity`. Khai lẫn lộn thì backend từ
 * chối — ràng buộc ấy nằm trong cả domain lẫn `ck_zone_shape` của database.
 *
 * `layout` bỏ trống nghĩa là **chưa đặt vị trí**, và bố cục tự động sẽ xếp khu này xuống dưới sân
 * khấu. Khác hẳn "đặt đúng chỗ mặc định": khu chưa đặt sẽ tự dịch xuống khi chèn thêm khu phía
 * trên, khu đã đặt thì đứng yên.
 */
export interface ZoneInput {
  zoneCode: string;
  name: string;
  kind: 'SEATED' | 'STANDING';
  rowCount?: number;
  seatsPerRow?: number;
  capacity?: number;
  sortOrder?: number;
  layout?: ZoneLayoutInput;
}

/**
 * Thay **toàn bộ** sơ đồ của một địa điểm.
 *
 * `PUT` vì đây là phép thay thế, không phải phép thêm. Khu giữ nguyên `zoneCode` thì giữ nguyên
 * id, nên sửa "VIP: 100 → 150 ghế" không làm mất mức giá đã khai cho khu VIP.
 *
 * `stage` bỏ trống đưa địa điểm về sân khấu mặc định.
 */
export interface ConfigureZonesRequest {
  stage?: StageInput;
  zones: ZoneInput[];
}

/**
 * @param removedTicketTypes số hạng vé bị xoá theo khu không còn nữa. Có mặt trong phản hồi chứ
 *   không âm thầm: xoá khu "Thường" cũng xoá mức giá đã khai cho nó.
 */
export interface ConfigureZonesResult {
  venue: unknown;
  inserted: number;
  updated: number;
  removedZones: number;
  removedTicketTypes: number;
}

/**
 * Ảnh sơ đồ khu vực ghế, nhìn từ màn hình quản trị.
 *
 * Trang khách chỉ nhận **một** địa chỉ đã giải sẵn (`PublicEventDetail.seatMapImageUrl`). Màn hình
 * quản trị cần cả hai: ban tổ chức phải thấy mình đang dùng ảnh riêng hay đang mượn ảnh của địa
 * điểm — nếu không thì gỡ ảnh riêng xong, ảnh địa điểm hiện lên thế chỗ và nút gỡ trông như hỏng.
 */
export interface SeatMapImages {
  eventImageUrl: string | null;
  venueImageUrl: string | null;
  /** Tấm khách thật sự nhìn thấy. Backend giải, không phải giao diện. */
  effectiveImageUrl: string | null;
}
