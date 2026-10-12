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

/** Suất diễn được nhân viên phép check-in trong một tổ chức. */
export interface CheckinSession {
  eventSessionId: string;
  eventId: string;
  eventTitle: string;
  venueName: string;
  startsAt: string;
  endsAt: string | null;
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

/* ---------------------------------------------------------------------------
 * Soát vé có vào / ra / vào lại
 *
 * Kiểu RIÊNG, không mở rộng `CheckinResult` ở trên: web-scanner rẽ nhánh giao diện bằng một
 * `Record<CheckinResult, …>`, và thêm giá trị vào union đó là buộc nó phải sửa theo. Máy soát vé
 * nào gửi `direction` thì nhận về bộ kết quả đầy đủ này; không gửi thì backend quy về sáu giá trị cũ.
 * ------------------------------------------------------------------------- */

export type ScanDirection = 'IN' | 'OUT';

/**
 * Kết quả một lượt quét ở cửa.
 *
 * `ACCEPTED` là cho vào (lần đầu hoặc vào lại — xem `entryCount`), `EXITED` là ghi nhận ra. Mọi giá
 * trị còn lại là từ chối, và lý do quyết định nhân viên nói gì với khách.
 */
export type GateScanResult =
  | 'ACCEPTED'
  | 'EXITED'
  /** Quét Vào một vé đang ở trong — dấu hiệu dùng chung mã QR. */
  | 'ALREADY_CHECKED_IN'
  /** Quét Ra một vé chưa vào hoặc đã ra. */
  | 'NOT_INSIDE'
  | 'REVOKED'
  | 'WRONG_SESSION'
  | 'NOT_OPEN_YET'
  | 'SESSION_ENDED'
  | 'REENTRY_NOT_ALLOWED'
  | 'INVALID_TOKEN'
  | 'NOT_FOUND';

export interface GateScanRequest {
  /** Bắt buộc phải gửi: thiếu nó backend coi đây là máy soát vé đời đầu. */
  direction: ScanDirection;
  /** Mã QR vừa quét. Bỏ trống khi gõ `ticketCode`. */
  qrToken?: string;
  /** Mã vé gõ tay vì QR hỏng — tối thiểu 8 ký tự in trên vé. */
  ticketCode?: string;
  deviceId?: string;
  /** Cổng đang soát, nếu sự kiện có nhiều cổng. */
  gate?: string;
  /** Cho vào thủ công dù vé đang được ghi nhận là ở trong. Cần quyền `CATALOG_MANAGE` và `reason`. */
  override?: boolean;
  reason?: string;
}

export interface GateScanResponse {
  result: GateScanResult;
  direction: ScanDirection;
  /** Mọi nhãn dưới đây do SERVER trả về sau khi đã kiểm quyền — mã QR cố ý không chứa gì. */
  seatCode: string | null;
  seatLabel: string | null;
  ticketTypeName: string | null;
  note: string | null;
  /** 8 ký tự đầu của id vé — đúng mã in trên vé của khách. */
  ticketCode: string | null;
  holderName: string | null;
  zoneCode: string | null;
  /** Số lần vé đã vào cửa, tính cả lần này nếu được cho vào. */
  entryCount: number;
  /** Lần vào gần nhất — thứ đọc cho khách khi vé "đang ở trong". */
  lastEntryAt: string | null;
  lastEntryGate: string | null;
  /** Suất của vé; khác suất đang soát khi `result` là `WRONG_SESSION`. */
  ticketSessionId: string | null;
}

export interface CheckinHistoryRow {
  id: string;
  /** `null` khi lần quét không dẫn tới vé nào (mã giả, mã gõ sai). */
  ticketCode: string | null;
  scannedAt: string;
  direction: ScanDirection;
  result: GateScanResult;
  /** `QR` quét mã · `CODE` gõ mã vé · `OVERRIDE` cho vào thủ công. */
  method: 'QR' | 'CODE' | 'OVERRIDE';
  gate: string | null;
  note: string | null;
  holderName: string | null;
  seatCode: string | null;
  seatLabel: string | null;
  ticketTypeName: string | null;
}

/** Lịch sử quét của một suất, mới nhất trước, kèm số khách hiện tại. */
export interface CheckinHistory {
  /** Số khách đang ở trong khu vực. */
  inside: number;
  /** Số vé đã vào ít nhất một lần. */
  checkedIn: number;
  rows: CheckinHistoryRow[];
  page: number;
  size: number;
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
