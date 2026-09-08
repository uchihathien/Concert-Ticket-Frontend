import type { ApiClient } from '../http/client';
import type { OrganizationBalance, TrialBalance } from '../types/ledger';

/**
 * `ledger-service` — chỉ superadmin.
 *
 * Hai lưu ý về gateway, cả hai đều là việc của backend chứ không phải thiếu sót của SDK:
 *
 * 1. `application.yml` của api-gateway chưa có route nào trỏ tới ledger, nên `/v1/platform/
 *    trial-balance` hiện trả 404 khi gọi qua cổng 8080. Route thêm ở giai đoạn G4.
 * 2. `/v1/platform/organizations/{id}/balance` **trùng** predicate `/v1/platform/organizations/**`
 *    vốn đang trỏ về identity. Khi bật ledger, hai service sẽ tranh cùng một tiền tố đường dẫn.
 */

export async function getTrialBalance(client: ApiClient): Promise<TrialBalance> {
  const response = await client.get<TrialBalance>('/v1/platform/trial-balance');
  return response.data;
}

export async function getOrganizationBalance(
  client: ApiClient,
  organizationId: string,
): Promise<OrganizationBalance> {
  const response = await client.get<OrganizationBalance>(
    `/v1/platform/organizations/${organizationId}/balance`,
  );
  return response.data;
}
