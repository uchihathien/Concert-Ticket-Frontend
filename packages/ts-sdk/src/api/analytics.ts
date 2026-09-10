import type { ApiClient } from '../http/client';
import type { OrganizationSales } from '../types/analytics';

/**
 * Doanh thu của một tổ chức.
 *
 * `TenantFilter` ở backend đã kiểm tư cách thành viên từ chính đường dẫn và trả **404** nếu người
 * gọi không thuộc tổ chức đó — không phải 403, để không tiết lộ tổ chức ấy có tồn tại hay không.
 *
 * Gateway route `/v1/admin/**` sang `analytics-service` (cổng 8099), và service đó dựng số từ
 * consumer `analytics.ordering.all`. Cả hai đều phải chạy: thiếu gateway thì ra 404 của chính
 * gateway, còn thiếu consumer thì mọi số đều bằng 0 mà không có lỗi nào.
 */
export async function fetchOrganizationSales(
  client: ApiClient,
  organizationId: string,
): Promise<OrganizationSales> {
  const response = await client.get<OrganizationSales>(
    `/v1/admin/organizations/${encodeURIComponent(organizationId)}/sales`,
  );
  return response.data;
}
