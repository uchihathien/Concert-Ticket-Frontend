import type { ApiClient } from '../http/client';
import type { EventMasterData, OrganizationDashboard } from '../types/dashboard';

/**
 * Bảng điều khiển của ban tổ chức.
 *
 * Hai endpoint, hai câu hỏi: "tôi đang có những sự kiện nào" và "sự kiện này đang ra sao".
 * Cái thứ hai ghép dữ liệu của ba service ở backend — xem `types/dashboard.ts` để biết vì sao
 * `degraded` phải được xử lý chứ không bỏ qua.
 */

export async function getOrganizationDashboard(
  client: ApiClient,
  organizationId: string,
): Promise<OrganizationDashboard> {
  const response = await client.get<OrganizationDashboard>(
    `/v1/organizations/${organizationId}/dashboard`,
  );
  return response.data;
}

export async function getEventMasterData(
  client: ApiClient,
  organizationId: string,
  eventId: string,
): Promise<EventMasterData> {
  const response = await client.get<EventMasterData>(
    `/v1/organizations/${organizationId}/events/${eventId}/master-data`,
  );
  return response.data;
}
