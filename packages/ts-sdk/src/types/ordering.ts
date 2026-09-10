/**
 * Hợp đồng của `ordering-service`.
 *
 * Nguồn: `OrderController`, `OrderView`, `OrderStatus`.
 */

/**
 * Vòng đời đơn hàng — đúng năm giá trị này.
 *
 * `EXPIRED` và `CANCELLED` khác nhau ở chỗ **ai** kết thúc đơn: hệ thống hết giờ chuyển khoản, hay
 * chính khách bấm huỷ. Gộp hai cái vào một nhãn "đã huỷ" là bỏ mất câu trả lời cho khiếu nại
 * "tôi có bấm huỷ đâu".
 */
export type OrderStatus =
  | 'AWAITING_PAYMENT'
  | 'PAID'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'REFUNDED'
  /**
   * Tiền vào sau khi đơn đã đóng — khách chuyển khoản ở phút chót và webhook tới sau khi job hết
   * hạn vừa nhả ghế. Không phải PAID: chỗ có thể đã bán cho người khác nên không có vé nào được
   * phát. Đơn nằm chờ người của nền tảng xử lý, thường là hoàn tiền.
   */
  | 'MANUAL_REVIEW';

export interface OrderItem {
  /** Ghế đánh số. Vé đứng thì trường này rỗng — phân biệt bằng `admissionType`. */
  seatCode: string | null;
  zoneCode: string;
  /** `SEATED` hoặc `STANDING`. */
  admissionType: string;
  seatLabel: string | null;
  ticketTypeName: string;
  unitPriceVnd: number;
  discountVnd: number;
}

/**
 * Đơn hàng như khách nhìn thấy.
 *
 * Cố ý **không** có hoa hồng: đó là chuyện giữa nền tảng và ban tổ chức (ADR-1010). Đừng thêm vào
 * đây kể cả khi màn quản trị cần — bản nội bộ là endpoint khác.
 */
export interface Order {
  id: string;
  orderNumber: string;
  /** Suất diễn của đơn — dùng để tra tên sự kiện, giờ diễn và địa điểm. */
  eventSessionId: string;
  /** Sự kiện của suất. Null với đơn tạo trước khi backend lưu trường này. */
  eventId: string | null;
  status: OrderStatus;
  subtotalVnd: number;
  discountVnd: number;
  totalVnd: number;
  /**
   * Nội dung chuyển khoản, ví dụ `NT1000001`.
   *
   * Từ khi chuyển sang payOS (ADR-0016) đây **không còn là khoá đối soát**: payOS khớp tiền với đơn bằng
   * `orderCode` trong một webhook đã ký, nên khách gõ sai nội dung không còn làm tiền mồ côi. Vẫn hiện ra
   * để người chuyển khoản tay có thứ đối chiếu, nhưng nó không còn là thứ quan trọng nhất trên màn hình.
   */
  paymentReference: string | null;
  /**
   * Chuỗi EMVCo của mã VietQR payOS sinh, trỏ về tài khoản ảo của **riêng đơn này**.
   *
   * Frontend tự dựng QR từ nó — backend cố ý không trả ảnh.
   */
  vietQrPayload: string | null;
  /**
   * Trang thanh toán payOS host — **đường chính** để khách trả tiền.
   *
   * Ở đó khách chọn ngân hàng, thấy trạng thái trả tiền theo thời gian thực, và không phải tự gõ nội dung
   * chuyển khoản. Quét QR là đường phụ cho người muốn tự làm trong app ngân hàng.
   *
   * `null` với đơn tạo từ trước ADR-0016, và với đơn đã đóng. UI phải chịu được điều đó.
   */
  checkoutUrl: string | null;
  /** ISO-8601. Mốc tuyệt đối để đếm ngược, đừng tự cộng thêm phút ở client. */
  paymentExpiresAt: string | null;
  paidAt: string | null;
  items: OrderItem[];
}

export interface PlaceOrderRequest {
  holdId: string;
  promotionCode?: string;
}

/** Trả về ngay sau `POST /v1/orders`. Ít trường hơn `Order` — chưa có `items`. */
export interface OrderCreated {
  orderId: string;
  orderNumber: string;
  totalVnd: number;
  paymentReference: string;
  vietQrPayload: string;
  /** Trang thanh toán payOS host. Có thể `null` nếu payment-service cũ hơn trong lúc rolling deploy. */
  checkoutUrl: string | null;
  paymentExpiresAt: string;
}

export interface ListMyOrdersParams {
  /** Backend kẹp trần ở 100. */
  limit?: number;
  offset?: number;
}
