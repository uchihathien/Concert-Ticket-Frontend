/**
 * Hợp đồng của `ticketing-service`.
 *
 * Nguồn: `CheckinController`, `MyTicketsController`, `OrganizationTicketController`.
 */

/**
 * Kết quả soát vé.
 *
 * Chỉ `ACCEPTED` là cho vào; năm giá trị còn lại đều là từ chối nhưng vì lý do khác nhau, và ở
 * cửa vào thì lý do quan trọng hơn kết quả — nhân viên phải biết nói gì với khách.
 */
export type CheckinResult =
  'ACCEPTED' | 'ALREADY_CHECKED_IN' | 'REVOKED' | 'WRONG_SESSION' | 'INVALID_TOKEN' | 'NOT_FOUND';

export interface ScanRequest {
  qrToken: string;
  /** Máy nào quét. Giúp truy lại khi có tranh chấp ở cửa. */
  deviceId?: string;
}

/**
 * Backend **luôn trả 200**, kể cả khi vé bị từ chối — kết quả nằm trong body.
 *
 * Nghĩa là `ApiClient` sẽ không ném lỗi cho vé sai, và màn soát vé phải rẽ nhánh theo `result`.
 * Đây là chủ ý của backend: một mã lỗi HTTP không nói được "đã soát lúc 19:42".
 */
export interface ScanResponse {
  result: CheckinResult;
  /** Do SERVER trả về sau khi đã kiểm quyền — mã QR cố ý không chứa thông tin gì. */
  seatCode: string | null;
  seatLabel: string | null;
  ticketTypeName: string | null;
  note: string | null;
}

/** Vòng đời một vé. `REVOKED` không quay lại `VALID` được. */
export type TicketStatus = 'VALID' | 'CHECKED_IN' | 'REVOKED';

/**
 * Vé trong ví của khách.
 *
 * `qrToken` là chuỗi JWS, frontend tự dựng QR từ nó. Mã QR **không chứa** thông tin ghế hay tên
 * khách — mọi thứ hiện ở cửa đều do server trả về sau khi đã kiểm quyền.
 *
 * Không có tên sự kiện: ticketing chỉ biết `eventSessionId`. Muốn hiện "Rock Fest · Biển Đông"
 * thì phải tra thêm catalog, xem `groupTicketsBySession`.
 */
export interface Ticket {
  id: string;
  orderId: string;
  eventSessionId: string;
  seatCode: string | null;
  zoneCode: string;
  /** `SEATED` hoặc `STANDING`. */
  admissionType: string;
  seatLabel: string | null;
  ticketTypeName: string;
  status: TicketStatus;
  checkedInAt: string | null;
  qrToken: string;
}

export interface ListMyTicketsParams {
  /** Backend kẹp trần ở 100. */
  limit?: number;
  offset?: number;
}

/**
 * Trạng thái thanh toán của đơn đứng sau một vé.
 *
 * Khác `TicketStatus`: một vé `REVOKED` có thể vì đơn đã hoàn tiền, hoặc vì ban tổ chức thu hồi vé
 * (gian lận, sai sót). Hai việc đó xử lý khác nhau và `status` một mình không phân biệt được.
 */
export type TicketPaymentStatus = 'PAID' | 'REFUNDED';

/**
 * Một dòng trong bảng tra cứu vé của ban tổ chức.
 *
 * Khác `Ticket` (ví vé của khách): có tên người mua, **không** có `qrToken`. Ban tổ chức không
 * cần — và không được — cầm mã vào cửa của khách.
 */
export interface OrganizationTicket {
  ticketId: string;
  orderId: string;
  eventSessionId: string;
  seatCode: string | null;
  zoneCode: string;
  seatLabel: string | null;
  ticketTypeName: string;
  /** `null` khi identity không trả lời được lúc phát vé. Hiện "—", không phải ô trống. */
  holderName: string | null;
  status: TicketStatus;
  paymentStatus: TicketPaymentStatus;
  issuedAt: string;
  checkedInAt: string | null;
}

export interface OrganizationTicketPage {
  rows: OrganizationTicket[];
  /** Tổng số vé khớp bộ lọc, không phải số dòng trả về — để hiện "1–50 trong 2.480". */
  total: number;
  page: number;
  size: number;
}

/**
 * Bộ lọc tra cứu vé.
 *
 * `query` là **một** ô nhập cho cả mã vé, mã chỗ và tên khách: người trực tổng đài không biết
 * trước khách sắp đọc thứ gì cho mình.
 */
export interface TicketSearchParams {
  eventSessionId?: string;
  query?: string;
  zoneCode?: string;
  status?: TicketStatus;
  paymentStatus?: TicketPaymentStatus;
  page?: number;
  /** Backend kẹp trần ở 100. */
  size?: number;
}
