import type { ApiClient } from '../http/client';
import type { ListMyOrdersParams, Order, OrderCreated, PlaceOrderRequest } from '../types/ordering';

/**
 * Đơn hàng.
 *
 * Tất cả đều cần đăng nhập — backend lấy người mua từ token, không nhận `userId` từ client.
 */

/**
 * Đặt đơn từ một lượt giữ chỗ.
 *
 * `idempotencyKey` là **bắt buộc**: filter của backend chặn request thiếu khoá trước cả khi vào
 * controller. Khoá phải gắn với *ý định mua* — sinh một lần lúc khách bấm "Thanh toán" rồi dùng
 * lại cho mọi lần thử lại. Sinh mới mỗi lần gửi thì mạng chập chờn sẽ thành hai đơn.
 */
export async function placeOrder(
  client: ApiClient,
  request: PlaceOrderRequest,
  idempotencyKey: string,
): Promise<OrderCreated> {
  const response = await client.post<OrderCreated>('/v1/orders', request, { idempotencyKey });
  return response.data;
}

/** Đơn của người khác cũng trả 404, không phải 403 — không tiết lộ đơn đó có tồn tại hay không. */
export async function getOrder(client: ApiClient, orderId: string): Promise<Order> {
  const response = await client.get<Order>(`/v1/orders/${encodeURIComponent(orderId)}`);
  return response.data;
}

/** Đơn của chính mình, mới nhất trước. Backend kẹp `limit` ở 100. */
export async function listMyOrders(
  client: ApiClient,
  params: ListMyOrdersParams = {},
): Promise<Order[]> {
  const search = new URLSearchParams();
  if (params.limit !== undefined) search.set('limit', String(params.limit));
  if (params.offset !== undefined) search.set('offset', String(params.offset));

  const query = search.toString();
  const response = await client.get<Order[]>(`/v1/me/orders${query ? `?${query}` : ''}`);
  return response.data;
}

/** Chỉ đơn `AWAITING_PAYMENT` huỷ được; đơn đã trả tiền phải đi đường hoàn tiền. Trả 204. */
export async function cancelOrder(client: ApiClient, orderId: string): Promise<void> {
  await client.post<null>(`/v1/orders/${encodeURIComponent(orderId)}/cancel`);
}
