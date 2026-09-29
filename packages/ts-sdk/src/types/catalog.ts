/**
 * Hợp đồng của `catalog-service` — chép từ `CatalogViews` và các record request của
 * `AdminCatalogController`, không suy diễn.
 *
 * Lưu ý về đường dẫn: khu quản trị là `/v1/organizations/{organizationId}/…` chứ không phải
 * `/v1/admin/…`. Tổ chức nằm trên đường dẫn là có chủ đích — `TenantFilter` lấy nó từ đó và trả
 * 404 nếu người gọi không phải thành viên. Không có nó, người thuộc hai tổ chức sẽ im lặng thao
 * tác nhầm tổ chức.
 */

/** Đúng bằng enum `EventStatus` của catalog. `CANCELLED` là trạng thái cuối, không quay lại được. */
export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED' | 'CANCELLED';

export type ZoneKind = 'SEATED' | 'STANDING';

export interface AdminZone {
  id: string;
  zoneCode: string;
  name: string;
  kind: ZoneKind;
  /** Khu ngồi mới có số hàng; khu đứng thì `capacity`. Backend ép luật này ở domain và ở CHECK. */
  rowCount: number | null;
  seatsPerRow: number | null;
  capacity: number | null;
  seatCount: number;
  /**
   * Vị trí trên mặt bằng.
   *
   * `null` nghĩa là **chưa đặt**, và bố cục tự động xếp khu này xuống dưới sân khấu. Khác hẳn
   * "đặt đúng chỗ mặc định": khu chưa đặt sẽ tự dịch xuống khi chèn thêm khu phía trên, khu đã
   * đặt thì đứng yên. Đừng chuẩn hoá `null` thành một giá trị mặc định trước khi gửi lại —
   * một lần lưu như thế sẽ ghim mọi khu lại vĩnh viễn.
   */
  layout: AdminZoneLayout | null;
}

/** `rotationDeg` có với `GRID`/`TABLE`; `innerRadius` có với `ARC`/`TABLE`; hai góc chỉ có với `ARC`.
 * Trường không dùng trả `null`. */
export interface AdminZoneLayout {
  shape: 'GRID' | 'ARC' | 'TABLE';
  originX: number;
  originY: number;
  rotationDeg: number | null;
  innerRadius: number | null;
  startAngleDeg: number | null;
  endAngleDeg: number | null;
}

/** `height` với `CIRCLE` là đường kính, backend đã giải sẵn. */
export interface AdminStage {
  shape: 'RECTANGLE' | 'CIRCLE' | 'THRUST';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AdminVenue {
  id: string;
  name: string;
  city: string;
  address: string | null;
  capacity: number;
  /** `null` nghĩa là chưa khai và hệ thống dùng sân khấu mặc định — xem `AdminZone.layout`. */
  stage: AdminStage | null;
  zones: AdminZone[];
}

export interface AdminTicketType {
  id: string;
  venueZoneId: string;
  zoneCode: string;
  zoneName: string;
  name: string;
  priceVnd: number;
  capacity: number;
}

export interface AdminSession {
  id: string;
  /** ISO-8601. */
  startsAt: string;
  endsAt: string | null;
  salesOpenAt: string | null;
  salesCloseAt: string | null;
  maxSeatedPerHold: number | null;
  maxStandingPerHold: number | null;
  maxUnitsPerHold: number | null;
  maxTicketsPerCustomer: number | null;
  ticketTypes: AdminTicketType[];
}

/** Một dòng trong bảng sự kiện của ban tổ chức. Gồm cả bản nháp. */
export interface AdminEventRow {
  id: string;
  slug: string;
  title: string;
  category: string;
  status: EventStatus;
  publishedAt: string | null;
  venueName: string | null;
  nextSessionAt: string | null;
  sessionCount: number;
  ticketTypeCount: number;
  capacity: number;
}

export interface AdminEventDetail {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  category: string;
  posterUrl: string | null;
  status: EventStatus;
  publishedAt: string | null;
  venue: AdminVenue;
  sessions: AdminSession[];
  /** Những gì còn thiếu để publish. Rỗng nghĩa là bấm Publish được. */
  blockers: string[];
}

export interface CreateVenueRequest {
  name: string;
  city: string;
  address?: string;
}

export interface CreateZoneRequest {
  zoneCode: string;
  name: string;
  kind: ZoneKind;
  rowCount?: number;
  seatsPerRow?: number;
  capacity?: number;
  sortOrder?: number;
}

export interface CreateEventRequest {
  venueId: string;
  title: string;
  /** Bỏ trống thì backend sinh từ `title`. */
  slug?: string;
  summary?: string;
  description?: string;
  category: string;
  posterUrl?: string;
}

/** Mọi trường tuỳ chọn: `null`/thiếu nghĩa là "giữ nguyên", không phải "xoá đi". */
export interface UpdateEventRequest {
  title?: string;
  summary?: string;
  description?: string;
  category?: string;
  posterUrl?: string;
}

export interface CreateSessionRequest {
  startsAt: string;
  endsAt?: string;
  salesOpenAt: string;
  salesCloseAt: string;
  maxSeatedPerHold?: number;
  maxStandingPerHold?: number;
  maxUnitsPerHold?: number;
  maxTicketsPerCustomer?: number;
}

export interface CreateTicketTypeRequest {
  venueZoneId: string;
  name: string;
  priceVnd: number;
  sortOrder?: number;
}

/**
 * Sửa suất diễn. Mốc thời gian bỏ trống nghĩa là "giữ nguyên".
 *
 * Trần mua vé thì KHÁC: `null` ở đó là một giá trị có nghĩa ("theo mặc định nền tảng"), nên backend
 * luôn ghi đè bằng đúng thứ gửi lên. Form phải gửi lại giá trị hiện có nếu không muốn đổi — bỏ
 * trống một ô trần là xoá trần đó, không phải giữ nguyên.
 */
export interface UpdateSessionRequest {
  startsAt?: string;
  endsAt?: string;
  salesOpenAt?: string;
  salesCloseAt?: string;
  maxSeatedPerHold?: number | null;
  maxStandingPerHold?: number | null;
  maxUnitsPerHold?: number | null;
  maxTicketsPerCustomer?: number | null;
}

/** Sửa hạng vé; trường nào bỏ trống thì giữ nguyên. Không đổi được khu — đó là tạo hạng vé khác. */
export interface UpdateTicketTypeRequest {
  name?: string;
  priceVnd?: number;
  sortOrder?: number;
}
