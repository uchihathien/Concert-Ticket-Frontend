import type { ApiClient } from '../http/client';
import type { OrganizationTicketPage, TicketSearchParams } from '../types/ticketing';

/**
 * Tra cứu vé của ban tổ chức.
 *
 * Bộ lọc đi trên query string, không trong body: một bộ lọc dán được cho đồng nghiệp là thứ màn
 * hình hỗ trợ khách hàng dùng hàng ngày ("mở link này xem giúp tôi vé của chị Lan").
 */
export async function searchOrganizationTickets(
  client: ApiClient,
  organizationId: string,
  params: TicketSearchParams = {},
): Promise<OrganizationTicketPage> {
  const search = new URLSearchParams();
  if (params.eventSessionId) search.set('eventSessionId', params.eventSessionId);
  if (params.query) search.set('query', params.query);
  if (params.zoneCode) search.set('zoneCode', params.zoneCode);
  if (params.status) search.set('status', params.status);
  if (params.paymentStatus) search.set('paymentStatus', params.paymentStatus);
  if (params.page !== undefined) search.set('page', String(params.page));
  if (params.size !== undefined) search.set('size', String(params.size));

  const query = search.toString();
  const response = await client.get<OrganizationTicketPage>(
    `/v1/organizations/${organizationId}/tickets${query ? `?${query}` : ''}`,
  );
  return response.data;
}
