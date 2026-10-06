/**
 * Chat hỗ trợ và việc chuyển tiếp sang người thật.
 *
 * Nguồn: `SupportChatController`, `SupportDeskController`, `HandoffViews` của ai-chatbox-service.
 */

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
}

export interface AskRequest {
  /** Bỏ trống thì backend mở phiên mới và trả id về trong `sessionId`. */
  sessionId?: string;
  message: string;
}

export interface AskResponse {
  sessionId: string;
  answer: string;
  /** Tên tool trợ lý đã gọi. Hữu ích khi gỡ lỗi, không nhất thiết hiện cho khách. */
  toolsUsed: string[];
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
