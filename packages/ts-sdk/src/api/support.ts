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
} from '../types/support';

/** Chat hỗ trợ — phía khách. */

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
  const response = await client.post<AskResponse>('/v1/chat/agent/support', request, { idempotencyKey });
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

export async function listHandoffs(
  client: ApiClient,
  params: { mine?: boolean; page?: number; size?: number } = {},
): Promise<Handoff[]> {
  const search = new URLSearchParams();
  if (params.mine) search.set('mine', 'true');
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

/** 409 `HANDOFF_ALREADY_TAKEN` nghĩa là người khác vừa nhận — gỡ phiếu khỏi danh sách, đừng thử lại. */
export async function claimHandoff(client: ApiClient, handoffId: string): Promise<Handoff> {
  const response = await client.post<Handoff>(`/v1/support/handoffs/${handoffId}/claim`, {});
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
export async function previewKnowledge(client: ApiClient, question: string): Promise<RetrievedChunk[]> {
  const response = await client.get<RetrievedChunk[]>(
    `/v1/support/knowledge/preview?q=${encodeURIComponent(question)}`,
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
  body: { eventTitle: string; content: string; published: boolean },
): Promise<EventRules> {
  const response = await client.put<EventRules>(`/v1/support/knowledge/rules/${eventId}`, body);
  return response.data;
}
