/**
 * Hợp đồng của `ticketing-service`.
 *
 * Nguồn: `CheckinController`, `MyTicketsController`.
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
