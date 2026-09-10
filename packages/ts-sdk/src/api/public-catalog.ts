import type { ApiClient } from '../http/client';
import type { EventPage, ListEventsParams, PublicEventDetail } from '../types/public-catalog';

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
