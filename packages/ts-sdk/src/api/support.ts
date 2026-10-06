import type { ApiClient } from '../http/client';
import type {
  AskRequest,
  AskResponse,
  ChatThread,
  EventRules,
  Handoff,
  HandoffThread,
  KnowledgeChunk,
  RetrievedChunk,
  SupportIntent,
} from '../types/support';

/** Chat hỗ trợ — phía khách. */

/**
 * Hạn riêng của một lượt chat, ms.
 *
 * Bằng đúng ngân sách mà backend tự khai cho một lượt: 60s (nhúng) + `max-tool-iterations` × hạn
 * của nhà cung cấp mô hình = 60 + 4×120 = 540s — xem `spring.mvc.async.request-timeout` ở
 * `ai-chatbox-service/application.yml`.
 *
 * Bằng chứ không ngắn hơn, vì hai bên cắt cho ra hai thứ khác nhau. Hạn của backend nổ trước thì
 * người dùng nhận 503 "trợ lý đang bận" — nói đúng chuyện và có thể thử lại. Trình duyệt cắt
 * trước thì chỉ còn "Máy chủ phản hồi quá lâu", trong khi lượt chat vẫn đang chạy ở phía sau và
 * vẫn chiếm suất đồng thời của chính người ấy.
 *
 * Không ngắn hơn nữa cũng không dài hơn: 15 giây mặc định của client là lý do khung chat từng
 * không gửi được câu nào khi mô hình chạy tại chỗ trên CPU (đo thật: 114 giây một lượt).
 */
const CHAT_TURN_TIMEOUT_MS = 540_000;

/**
 * @param idempotencyKey khoá của một *ý định hỏi*, không phải của một request. Mạng rớt sau khi
 *   server đã trả lời xong là chuyện thường; lần gửi lại mang đúng khoá cũ thì backend trả lại câu
 *   trả lời đã lưu thay vì gọi mô hình lần nữa. Bỏ trống vẫn chạy, chỉ mất phần bảo vệ ấy.
 */
export async function askSupport(
  client: ApiClient,
  request: AskRequest,
  idempotencyKey?: string,
): Promise<AskResponse> {
  const response = await client.post<AskResponse>('/v1/chat/agent/support', request, {
    idempotencyKey,
    timeoutMs: CHAT_TURN_TIMEOUT_MS,
  });
  return response.data;
}

export async function getChatThread(client: ApiClient, sessionId: string): Promise<ChatThread> {
  const response = await client.get<ChatThread>(`/v1/chat/agent/sessions/${sessionId}/messages`);
  return response.data;
}

/** Nút "gặp nhân viên". Idempotent — bấm ba lần vẫn là một phiếu. */
export async function requestHumanAgent(client: ApiClient, sessionId: string): Promise<Handoff> {
  const response = await client.post<Handoff>(`/v1/chat/agent/sessions/${sessionId}/handoff`, {});
  return response.data;
}

/** Bàn hỗ trợ — phía người trực. Đòi quyền `PLATFORM_SUPPORT_HANDLE`. */

/**
 * @param status bỏ trống thì trả về HÀNG ĐỢI việc phải làm — phiếu chưa xong, cũ nhất trước. Truyền
 *   `RESOLVED` hoặc `ALL` để tra lịch sử, và lúc đó thứ tự đảo lại thành mới nhất trước: một hàng
 *   việc đọc từ phiếu chờ lâu nhất, còn một bảng tra cứu đọc từ việc vừa xảy ra.
 * @param intent chỉ lấy phiếu thuộc một ý định (REFUND, INCIDENT…). Không đổi thứ tự hàng đợi.
 * @param q tìm trong lý do chuyển tiếp và câu hỏi cuối của khách
 */
export async function listHandoffs(
  client: ApiClient,
  params: {
    mine?: boolean;
    status?: 'OPEN' | 'WAITING' | 'ASSIGNED' | 'RESOLVED' | 'ALL';
    intent?: SupportIntent;
    q?: string;
    page?: number;
    size?: number;
  } = {},
): Promise<Handoff[]> {
  const search = new URLSearchParams();
  if (params.mine) search.set('mine', 'true');
  if (params.status) search.set('status', params.status);
  if (params.intent) search.set('intent', params.intent);
  // Chỉ gửi khi có chữ: `q=` rỗng vẫn là "có tham số lọc" với backend, và nó sẽ đi nhánh tra cứu
  // (mới nhất trước) thay vì nhánh hàng đợi — đổi thứ tự màn hình chính mà không ai gõ gì cả.
  if (params.q && params.q.trim() !== '') search.set('q', params.q.trim());
  if (params.page !== undefined) search.set('page', String(params.page));
  if (params.size !== undefined) search.set('size', String(params.size));

  const query = search.toString();
  const response = await client.get<Handoff[]>(`/v1/support/handoffs${query ? `?${query}` : ''}`);
  return response.data;
}

export async function getHandoffThread(
  client: ApiClient,
  handoffId: string,
): Promise<HandoffThread> {
  const response = await client.get<HandoffThread>(`/v1/support/handoffs/${handoffId}`);
  return response.data;
}

/**
 * Nhận phiếu — trả về CẢ hội thoại kèm phiếu và checklist, không chỉ một dòng.
 *
 * 409 `HANDOFF_ALREADY_TAKEN` nghĩa là người khác vừa nhận — gỡ phiếu khỏi danh sách, đừng thử lại.
 */
export async function claimHandoff(client: ApiClient, handoffId: string): Promise<HandoffThread> {
  const response = await client.post<HandoffThread>(`/v1/support/handoffs/${handoffId}/claim`, {});
  return response.data;
}

export async function replyToHandoff(
  client: ApiClient,
  handoffId: string,
  text: string,
): Promise<HandoffThread> {
  const response = await client.post<HandoffThread>(`/v1/support/handoffs/${handoffId}/messages`, {
    text,
  });
  return response.data;
}

export async function resolveHandoff(client: ApiClient, handoffId: string): Promise<Handoff> {
  const response = await client.post<Handoff>(`/v1/support/handoffs/${handoffId}/resolve`, {});
  return response.data;
}

/** Kho tri thức của trợ lý. Cùng quyền với bàn hỗ trợ. */

export async function addKnowledgeChunk(
  client: ApiClient,
  body: { eventId?: string | null; title: string; content: string },
): Promise<KnowledgeChunk> {
  const response = await client.post<KnowledgeChunk>('/v1/support/knowledge/chunks', body);
  return response.data;
}

export async function listKnowledgeChunks(
  client: ApiClient,
  params: { eventId?: string; page?: number; size?: number } = {},
): Promise<KnowledgeChunk[]> {
  const search = new URLSearchParams();
  if (params.eventId) search.set('eventId', params.eventId);
  if (params.page !== undefined) search.set('page', String(params.page));
  if (params.size !== undefined) search.set('size', String(params.size));

  const query = search.toString();
  const response = await client.get<KnowledgeChunk[]>(
    `/v1/support/knowledge/chunks${query ? `?${query}` : ''}`,
  );
  return response.data;
}

export async function deleteKnowledgeChunk(client: ApiClient, id: string): Promise<void> {
  await client.delete(`/v1/support/knowledge/chunks/${id}`);
}

/**
 * Thử một câu hỏi và xem trợ lý lấy ra được gì.
 *
 * Đi qua đúng đường agent đi — cùng mô hình nhúng, cùng top-k, cùng ngưỡng. Đây là cách duy nhất
 * biết một đoạn vừa soạn có lấy ra được không mà không phải chờ khách thật hỏi trúng.
 */
export async function previewKnowledge(
  client: ApiClient,
  question: string,
): Promise<RetrievedChunk[]> {
  const response = await client.get<RetrievedChunk[]>(
    `/v1/support/knowledge/preview?q=${encodeURIComponent(question)}`,
    // Một lần nhúng. Lời gọi đầu sau khi mô hình bị nhả khỏi bộ nhớ mất ~21 giây vì Ollama phải
    // nạp lại 4,7GB; những lần sau ~130ms. 15 giây mặc định của client cắt đúng vào lần đầu ấy,
    // nên người soạn tri thức thấy "quá lâu" ở lần thử đầu tiên rồi bình thường ở lần thứ hai —
    // kiểu hỏng khó tin nhất. 60s là hạn nhúng mà backend tự khai (`embedding-timeout`).
    { timeoutMs: 60_000 },
  );
  return response.data;
}

export async function getEventRules(client: ApiClient, eventId: string): Promise<EventRules> {
  const response = await client.get<EventRules>(`/v1/support/knowledge/rules/${eventId}`);
  return response.data;
}

/** Ghi đè trọn bản. `published: false` giữ nó ở dạng nháp. */
export async function saveEventRules(
  client: ApiClient,
  eventId: string,
  body: {
    eventTitle: string;
    content: string;
    refundAllowed: boolean;
    refundWindowHours: number;
    published: boolean;
  },
): Promise<EventRules> {
  const response = await client.put<EventRules>(`/v1/support/knowledge/rules/${eventId}`, body);
  return response.data;
}
