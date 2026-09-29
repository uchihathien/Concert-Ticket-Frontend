import type { ApiClient } from '../http/client';
import type {
  EventPage,
  ListEventsParams,
  PublicEventCard,
  PublicEventDetail,
} from '../types/public-catalog';

/**
 * Catalog công khai.
 *
 * Không cần token — `SecurityAutoConfiguration` của backend mở sẵn `/v1/events/**`, và gateway
 * cũng cho `GET /v1/events/**` đi qua mà không xác thực.
 *
 * Hai endpoint này nên gọi từ **server component**, không phải từ trình duyệt: trang danh sách và
 * trang chi tiết cần HTML đầy đủ cho SEO, và gọi ở server thì không vướng CORS.
 */

export async function listPublicEvents(
  client: ApiClient,
  params: ListEventsParams = {},
): Promise<EventPage> {
  const search = new URLSearchParams();
  if (params.query) search.set('query', params.query);
  if (params.city) search.set('city', params.city);
  if (params.category) search.set('category', params.category);
  if (params.from) search.set('from', params.from);
  if (params.to) search.set('to', params.to);
  // `!== undefined` chứ không phải truthy: 0 là một mức giá hợp lệ ("miễn phí"), và `if (0)` sẽ
  // lặng lẽ bỏ nó đi.
  if (params.minPrice !== undefined) search.set('minPrice', String(params.minPrice));
  if (params.maxPrice !== undefined) search.set('maxPrice', String(params.maxPrice));
  if (params.page !== undefined) search.set('page', String(params.page));
  if (params.size !== undefined) search.set('size', String(params.size));

  const query = search.toString();
  const response = await client.get<EventPage>(`/v1/events${query ? `?${query}` : ''}`);
  return response.data;
}

/** Slug không tồn tại (hoặc sự kiện chưa xuất bản) → `ApiError` mã `EVENT_NOT_FOUND`, HTTP 404. */
export async function getPublicEvent(client: ApiClient, slug: string): Promise<PublicEventDetail> {
  const response = await client.get<PublicEventDetail>(`/v1/events/${encodeURIComponent(slug)}`);
  return response.data;
}

/**
 * Sự kiện đang bán chạy nhất, xếp giảm dần theo số vé đã bán.
 *
 * Trả về danh sách phẳng chứ không phải một trang: đây là một hàng thẻ trên trang chủ, không phải
 * một màn hình duyệt — không có phân trang, không có tổng số.
 *
 * Danh sách có thể NGẮN HƠN `size`, hoặc rỗng. Rỗng là trạng thái bình thường: hệ thống mới chạy
 * chưa ai mua vé, hoặc service thống kê đang không trả lời. Nơi gọi phải bỏ hẳn hàng ấy đi chứ
 * không hiện một hàng trống.
 */
export async function listTrendingEvents(client: ApiClient, size = 8): Promise<PublicEventCard[]> {
  const response = await client.get<PublicEventCard[]>(`/v1/events/trending?size=${size}`);
  return response.data;
}
