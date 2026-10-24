/**
 * Chat hỗ trợ và việc chuyển tiếp sang người thật.
 *
 * Nguồn: `SupportChatController`, `SupportDeskController`, `HandoffViews` của ai-chatbox-service.
 */

import type { OrderStatus } from './ordering';

/**
 * Ai nói.
 *
 * `ASSISTANT` và `AGENT` tách nhau một cách có chủ đích: khách phải biết mình đang nói với máy hay
 * với người. Gộp hai vai này khi hiển thị là làm giao diện nói dối.
 */
export type ChatRole = 'USER' | 'ASSISTANT' | 'AGENT';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** ISO-8601. */
  at: string;
}

/** WAITING: đang xếp hàng · ASSIGNED: có người nhận · RESOLVED: đã xong. */
export type HandoffStatus = 'WAITING' | 'ASSIGNED' | 'RESOLVED';

/** Để đo, không để hiển thị — người trực đọc `reason` viết bằng câu. */
export type HandoffTrigger = 'CUSTOMER_REQUEST' | 'LOW_CONFIDENCE';

/**
 * Khách cần gì — nhãn để bàn hỗ trợ chia việc.
 *
 * Khác `trigger` (vì sao phải chuyển), `intent` nói chuyển để làm gì: người quen xử lý hoàn tiền
 * lọc REFUND, người trực sự cố ngày diễn lọc INCIDENT.
 */
export type SupportIntent =
  | 'GENERAL'
  | 'ORDER_STATUS'
  | 'BOOKING'
  | 'REFUND'
  | 'INCIDENT'
  | 'COMPLAINT'
  | 'EVENT_INFO';

export interface Handoff {
  id: string;
  sessionId: string;
  status: HandoffStatus;
  trigger: HandoffTrigger;
  intent: SupportIntent;
  reason: string;
  /**
   * JSON có cấu trúc đi kèm phiếu — mã đơn, loại sự cố, kết quả xét chính sách hoàn vé… `null` với
   * phiếu chỉ có câu hỏi. Không có hình dạng cố định vì mỗi ý định mang dữ liệu khác; parse rồi hiện
   * dạng cặp khoá–giá trị là đủ.
   */
  details: string | null;
  /** Câu khách đang hỏi, chụp lúc chuyển. Có mặt ngay ở danh sách để khỏi phải mở từng phiếu. */
  lastQuestion: string | null;
  /** Id người hỏi. Luôn có — phiếu nào cũng thuộc về một tài khoản. */
  customerId: string;
  /**
   * Tên và email người hỏi, để người trực biết đang trả lời AI.
   *
   * Trước đây phiếu không mang gì về khách, nên hàng chờ là một danh sách phiếu giống hệt nhau. Email
   * cũng là đường duy nhất liên hệ lại khi khách đóng tab — phiếu bỏ dở sống 24 giờ.
   *
   * `null` khi identity-service không trả lời. Bàn hỗ trợ vẫn làm việc được, chỉ thiếu một cái tên.
   */
  customerName: string | null;
  customerEmail: string | null;
  assignedAgentId: string | null;
  /**
   * Tên người trực đang cầm phiếu, để hiện lên màn hình.
   *
   * `null` khi chưa ai nhận, và cũng `null` khi backend không tra được tên — hai chuyện khác nhau mà
   * giao diện xử lý như nhau, vì `status` đã nói rõ phiếu đã được nhận hay chưa.
   */
  assignedAgentName: string | null;
  requestedAt: string;
  /** Lúc có người nhận phiếu. `null` khi còn trong hàng đợi. */
  assignedAt: string | null;
  /** Lúc phiếu được đóng. `null` khi chưa xong. */
  resolvedAt: string | null;
  /** Tính ở backend: đồng hồ máy khách lệch vài phút thì phiếu chờ lâu nhất bị xếp sai thứ tự. */
  waitingSeconds: number;
}

/**
 * Màn hình của người trực: phiếu kèm cả hội thoại, một request.
 *
 * Cũng là thứ `claimHandoff` trả về — người vừa nhận phiếu đọc được ngay toàn bộ USER / ASSISTANT /
 * AGENT đã nói, không phải nhận xong rồi hỏi thêm một lần.
 */
export interface HandoffThread {
  handoff: Handoff;
  messages: ChatMessage[];
  /** Việc nên kiểm theo khung mẫu của loại sự cố; rỗng với phiếu không phải sự cố. */
  checklist: string[];
}

/**
 * Màn hình chat của khách.
 *
 * `handoff` khác `null` thì giao diện phải đổi hẳn: trợ lý AI đã ngừng trả lời, và mọi câu tiếp
 * theo chờ người thật. Hiện ô chat như bình thường ở trạng thái đó là hứa một thứ sẽ không tới
 * ngay.
 */
export interface ChatThread {
  sessionId: string;
  handoff: Handoff | null;
  messages: ChatMessage[];
  /**
   * Thẻ còn mở của phiên (đề xuất chưa hết hạn, hoặc thanh toán của đơn vừa tạo) — nguồn dựng lại thẻ
   * sau khi tải lại trang. `null` khi không có gì đang chờ khách.
   */
  action: ActionCard | null;
}

export interface AskRequest {
  /** Bỏ trống thì backend mở phiên mới và trả id về trong `sessionId`. */
  sessionId?: string;
  message: string;
}

/**
 * Thẻ hành động đi kèm câu trả lời — giao diện vẽ nút từ đây, không bao giờ parse `answer`.
 *
 * `BOOKING_PROPOSAL`: trợ lý vừa lập đề xuất, khách bấm Xác nhận/Huỷ. `PAYMENT`: đơn vừa tạo,
 * vẽ mã VietQR (chuỗi QR chỉ đi qua thẻ này, không qua mô hình). `BOOKING_INTENT` khai sẵn cho
 * Phase 2, chưa có dữ liệu.
 */
export interface BookingProposalCard {
  kind: 'BOOKING_PROPOSAL';
  id: string;
  /** Một dòng cho người đọc, vd. "2 vé VIP · Đêm nhạc Trịnh · 20:00 ngày 20/11/2026". */
  summary: string;
  eventTitle: string;
  sessionStartsAt: string | null;
  zoneCode: string;
  quantity: number;
  totalVnd: number;
  expiresAt: string;
}

export interface PaymentCard {
  kind: 'PAYMENT';
  orderId: string;
  orderNumber: string;
  totalVnd: number;
  /** Null khi thẻ dựng lại sau tải trang — lấy lại qua GET /v1/orders/{id}. */
  vietQrPayload: string | null;
  paymentReference: string | null;
  checkoutUrl: string | null;
  paymentExpiresAt: string | null;
  /**
   * Sự kiện của đơn — vắng khi catalog không trả lời lúc dựng thẻ, hoặc thẻ dựng từ bản lưu cũ. Thẻ vẫn
   * thanh toán được, chỉ thiếu dòng mô tả.
   */
  eventTitle?: string;
  eventSlug?: string;
  sessionStartsAt?: string;
  venueName?: string;
  lines?: PaymentCardLine[];
  /**
   * Trạng thái đơn lúc dựng thẻ (vd. khi khách hỏi "mình thanh toán chưa"). Vắng = vừa tạo, chưa tra
   * lại. Giao diện vẫn tự hỏi lại đơn — trường này chỉ để thẻ nói đúng ngay từ lần vẽ đầu.
   */
  status?: OrderStatus;
}

/** Một dòng vé trên thẻ thanh toán: "2 × VIP". */
export interface PaymentCardLine {
  zoneName: string;
  quantity: number;
  unitPriceVnd: number;
}

/** Bước đang hỏi trong luồng đặt vé bằng chip. */
export type ChoiceStep = 'EVENT' | 'SESSION' | 'ZONE' | 'QUANTITY';

/**
 * Một chip. Bấm là gửi `value` như một tin nhắn — server đối chiếu nó với đúng danh sách chip vừa
 * hiện, nên đừng sửa chữ trước khi gửi.
 */
export interface ChoiceOption {
  label: string;
  value: string;
  /** Dòng phụ, vd. "1.800.000đ · còn 12 chỗ". */
  hint?: string;
}

/** Các lựa chọn nhanh khi trợ lý cần khách chọn: sự kiện, suất, hạng vé, số vé. */
export interface ChoicesCard {
  kind: 'CHOICES';
  step: ChoiceStep;
  prompt: string;
  options: ChoiceOption[];
}

export type ActionCard = BookingProposalCard | PaymentCard | ChoicesCard;
export type ActionCardKind = ActionCard['kind'] | 'BOOKING_INTENT';

/** Đơn vừa tạo từ nút Đồng ý — bản rút gọn; VietQR nằm trong thẻ PAYMENT của `action`. */
export interface ProposalOrder {
  orderId: string;
  orderNumber: string;
  totalVnd: number;
  checkoutUrl: string | null;
  paymentExpiresAt: string | null;
}

/** Phản hồi 201 của `confirmProposal`. 409 (đã xác nhận) mang `order` và `action` trong `ApiError.meta`. */
export interface ProposalConfirmation {
  proposalId: string;
  status: 'CONFIRMED';
  order: ProposalOrder;
  action: PaymentCard;
}

export interface AskResponse {
  sessionId: string;
  answer: string;
  /** Tên tool trợ lý đã gọi. Hữu ích khi gỡ lỗi, không nhất thiết hiện cho khách. */
  toolsUsed: string[];
  /** Thẻ của lượt này; null khi không có. Luôn có mặt trong JSON. */
  action: ActionCard | null;
}

// --- Kho tri thức của trợ lý ------------------------------------------------
//
// Đòi quyền `PLATFORM_SUPPORT_HANDLE`, giống bàn hỗ trợ: người soạn câu trả lời cho trợ lý và
// người trực trả lời khách là cùng một nhóm việc.

export interface KnowledgeChunk {
  id: string;
  /** `null` là tri thức chung của nền tảng — phần lớn kho nên nằm ở đây. */
  eventId: string | null;
  title: string;
  content: string;
  /** ISO-8601. `null` ngay sau khi tạo, vì backend trả lại bản vừa ghi chứ không đọc lại. */
  createdAt: string | null;
}

/** Một đoạn lấy ra được cho câu hỏi thử. */
export interface RetrievedChunk {
  id: string;
  eventId: string | null;
  title: string;
  content: string;
  /** Khoảng cách cosine — nhỏ là gần. */
  distance: number;
  /**
   * Đoạn này có vượt ngưỡng không, tức trợ lý có thật sự đọc nó không.
   *
   * Đây là trường đáng nhìn nhất của màn hình soạn: pgvector luôn trả đủ top-k kể cả khi không có
   * gì liên quan, nên một danh sách dài toàn `used: false` nghĩa là kho đang không giúp gì.
   */
  used: boolean;
}

export interface EventRules {
  eventId: string;
  eventTitle: string;
  content: string;
  /** Sự kiện có nhận yêu cầu hoàn vé không. Tool `requestTicketRefund` của trợ lý thực thi cờ này. */
  refundAllowed: boolean;
  /** Số giờ kể từ lúc thanh toán còn được xin hoàn; 0 là không giới hạn. */
  refundWindowHours: number;
  /** `false` là bản nháp: khách không thấy, tool của trợ lý cũng không đọc. */
  published: boolean;
  updatedAt: string;
}
