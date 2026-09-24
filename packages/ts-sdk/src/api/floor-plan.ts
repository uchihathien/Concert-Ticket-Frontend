import type { ApiClient } from '../http/client';
import type { FloorPlan } from '../types/floor-plan';

/**
 * Mặt bằng khán phòng.
 *
 * Hai đường, hai người xem — xem ghi chú ở `types/floor-plan.ts` để biết vì sao bản công khai
 * không mang toạ độ ghế.
 */

/**
 * Bản công khai: sân khấu và đường bao khu. Không cần token.
 *
 * Backend đặt `Cache-Control: public, max-age=600` — hình dạng khán phòng gần như không đổi sau
 * khi đã bán vé, nên đừng thêm cache-buster vào URL này.
 */
export async function getPublicFloorPlan(client: ApiClient, slug: string): Promise<FloorPlan> {
  const response = await client.get<FloorPlan>(
    `/v1/events/${encodeURIComponent(slug)}/floor-plan`,
  );
  return response.data;
}

/** Bản quản trị: có toạ độ từng ghế, để xem trước sơ đồ khi chưa publish. */
export async function getVenueFloorPlan(
  client: ApiClient,
  organizationId: string,
  venueId: string,
): Promise<FloorPlan> {
  const response = await client.get<FloorPlan>(
    `/v1/organizations/${organizationId}/venues/${venueId}/floor-plan`,
  );
  return response.data;
}
