import type { ApiClient } from '../http/client';
import type { FloorPlan } from '../types/floor-plan';
import type { ConfigureZonesRequest, ConfigureZonesResult, SeatMapImages } from '../types/seating';

/** Thay toàn bộ sơ đồ khu của một địa điểm. */
export async function configureVenueZones(
  client: ApiClient,
  organizationId: string,
  venueId: string,
  request: ConfigureZonesRequest,
): Promise<ConfigureZonesResult> {
  const response = await client.put<ConfigureZonesResult>(
    `/v1/organizations/${organizationId}/venues/${venueId}/zones`,
    request,
  );
  return response.data;
}

/**
 * Xem trước một sơ đồ **chưa lưu**.
 *
 * Nhận đúng cùng body với `configureVenueZones` nhưng không ghi gì. Đây là cách trình sửa sơ đồ
 * thấy được kết quả mà không phải chép công thức toạ độ sang TypeScript — xem `types/seating.ts`.
 */
export async function previewFloorPlan(
  client: ApiClient,
  organizationId: string,
  venueId: string,
  request: ConfigureZonesRequest,
): Promise<FloorPlan> {
  const response = await client.post<FloorPlan>(
    `/v1/organizations/${organizationId}/venues/${venueId}/floor-plan/preview`,
    request,
  );
  return response.data;
}

/** Ảnh sơ đồ đang gắn với một sự kiện: của riêng nó, của địa điểm, và tấm đang có hiệu lực. */
export async function getSeatMapImages(
  client: ApiClient,
  organizationId: string,
  eventId: string,
): Promise<SeatMapImages> {
  const response = await client.get<SeatMapImages>(
    `/v1/organizations/${organizationId}/events/${eventId}/seat-map-image`,
  );
  return response.data;
}

/**
 * Đặt ảnh sơ đồ cho riêng một sự kiện.
 *
 * Chuỗi rỗng nghĩa là **gỡ ảnh** — và khác với `PATCH /events/{id}`, ở đây không có ngữ nghĩa "để
 * nguyên": endpoint chỉ mang một trường, nên gọi tới tức là muốn đổi.
 */
export async function setEventSeatMapImage(
  client: ApiClient,
  organizationId: string,
  eventId: string,
  imageUrl: string,
): Promise<void> {
  await client.put<null>(`/v1/organizations/${organizationId}/events/${eventId}/seat-map-image`, {
    imageUrl,
  });
}

/** Đặt ảnh sơ đồ cho địa điểm — dùng lại cho mọi sự kiện diễn ra ở đó. */
export async function setVenueSeatMapImage(
  client: ApiClient,
  organizationId: string,
  venueId: string,
  imageUrl: string,
): Promise<void> {
  await client.put<null>(`/v1/organizations/${organizationId}/venues/${venueId}/seat-map-image`, {
    imageUrl,
  });
}
