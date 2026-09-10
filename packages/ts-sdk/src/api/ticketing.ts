import type { ApiClient } from '../http/client';
import type { ListMyTicketsParams, ScanRequest, ScanResponse, Ticket } from '../types/ticketing';

/**
 * Soát vé.
 *
 * Backend **luôn trả 200**, kể cả khi vé bị từ chối — nên hàm này không ném lỗi cho vé sai, và
 * nơi gọi phải rẽ nhánh theo `result`. Chỉ lỗi mạng, 401 hay 5xx mới thành `ApiError`.
 *
 * Tổ chức của nhân viên lấy từ token đăng nhập ở phía backend, không gửi lên từ client: để client
 * gửi thì ai cũng soát được vé của tổ chức khác bằng cách đổi một trường JSON.
 */
export async function scanTicket(
  client: ApiClient,
  eventSessionId: string,
  request: ScanRequest,
): Promise<ScanResponse> {
  const response = await client.post<ScanResponse>(
    `/v1/sessions/${eventSessionId}/checkins`,
    request,
  );
  return response.data;
}

/** Ví vé của chính mình. Backend kẹp `limit` ở 100. */
export async function listMyTickets(
  client: ApiClient,
  params: ListMyTicketsParams = {},
): Promise<Ticket[]> {
  const search = new URLSearchParams();
  if (params.limit !== undefined) search.set('limit', String(params.limit));
  if (params.offset !== undefined) search.set('offset', String(params.offset));

  const query = search.toString();
  const response = await client.get<Ticket[]>(`/v1/me/tickets${query ? `?${query}` : ''}`);
  return response.data;
}

/** Vé của một đơn. Đơn của người khác trả 404, không phải 403. */
export async function listOrderTickets(client: ApiClient, orderId: string): Promise<Ticket[]> {
  const response = await client.get<Ticket[]>(`/v1/orders/${encodeURIComponent(orderId)}/tickets`);
  return response.data;
}
