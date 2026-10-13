import type { ApiClient } from '../http/client';
import type {
  BuyerExport,
  GateNoShows,
  SalesCustomers,
  GateActivity,
  GatePresence,
  InventoryStock,
  OrderBuyers,
  SalesBreakdown,
  SalesDistribution,
  SalesHeatmap,
  SalesSeries,
  SalesStatsParams,
  SalesSummary,
  StatsBucket,
  StatsOrderListParams,
  StatsOrderPage,
  StatsSession,
} from '../types/stats';

function base(organizationId: string): string {
  return `/v1/organizations/${encodeURIComponent(organizationId)}/stats`;
}

/** Tham số lặp (`eventId=a&eventId=b`): đúng dạng Spring đọc thành `List<UUID>`. */
function search(params: SalesStatsParams, extra: Record<string, string> = {}): string {
  const query = new URLSearchParams({ from: params.from, to: params.to, ...extra });
  for (const id of params.eventIds ?? []) query.append('eventId', id);
  for (const id of params.sessionIds ?? []) query.append('sessionId', id);
  for (const id of params.ticketTypeIds ?? []) query.append('ticketTypeId', id);
  return query.toString();
}

export async function getSalesSummary(
  client: ApiClient,
  organizationId: string,
  params: SalesStatsParams,
  compare: boolean,
): Promise<SalesSummary> {
  const response = await client.get<SalesSummary>(
    `${base(organizationId)}/orders/summary?${search(params, { compare: String(compare) })}`,
  );
  return response.data;
}

export async function getSalesSeries(
  client: ApiClient,
  organizationId: string,
  params: SalesStatsParams,
  bucket: StatsBucket,
  compare: boolean,
): Promise<SalesSeries> {
  const response = await client.get<SalesSeries>(
    `${base(organizationId)}/orders/timeseries?${search(params, { bucket, compare: String(compare) })}`,
  );
  return response.data;
}

export async function getSalesBreakdown(
  client: ApiClient,
  organizationId: string,
  params: SalesStatsParams,
): Promise<SalesBreakdown> {
  const response = await client.get<SalesBreakdown>(
    `${base(organizationId)}/orders/breakdown?${search(params)}`,
  );
  return response.data;
}

export async function getSalesHeatmap(
  client: ApiClient,
  organizationId: string,
  params: SalesStatsParams,
): Promise<SalesHeatmap> {
  const response = await client.get<SalesHeatmap>(
    `${base(organizationId)}/orders/heatmap?${search(params)}`,
  );
  return response.data;
}

export async function getInventoryStock(
  client: ApiClient,
  organizationId: string,
): Promise<InventoryStock> {
  const response = await client.get<InventoryStock>(`${base(organizationId)}/inventory/stock`);
  return response.data;
}

export async function getGatePresence(
  client: ApiClient,
  organizationId: string,
): Promise<GatePresence> {
  const response = await client.get<GatePresence>(`${base(organizationId)}/checkins/presence`);
  return response.data;
}

export async function getSalesDistribution(
  client: ApiClient,
  organizationId: string,
  params: SalesStatsParams,
): Promise<SalesDistribution> {
  const response = await client.get<SalesDistribution>(
    `${base(organizationId)}/orders/distribution?${search(params)}`,
  );
  return response.data;
}

export async function getStatsOrders(
  client: ApiClient,
  organizationId: string,
  params: StatsOrderListParams,
): Promise<StatsOrderPage> {
  const query = new URLSearchParams(search(params, { page: String(params.page), size: String(params.size) }));
  for (const status of params.statuses ?? []) query.append('status', status);
  if (params.query) query.set('query', params.query);
  const response = await client.get<StatsOrderPage>(`${base(organizationId)}/orders/list?${query.toString()}`);
  return response.data;
}

export async function getStatsSessions(client: ApiClient, organizationId: string): Promise<StatsSession[]> {
  const response = await client.get<{ sessions: StatsSession[] }>(`${base(organizationId)}/catalog/sessions`);
  return response.data.sessions;
}

export async function getGateActivity(
  client: ApiClient,
  organizationId: string,
  params: { from: string; to: string; sessionIds?: string[] },
): Promise<GateActivity> {
  const query = new URLSearchParams({ from: params.from, to: params.to });
  for (const id of params.sessionIds ?? []) query.append('sessionId', id);
  const response = await client.get<GateActivity>(`${base(organizationId)}/checkins/activity?${query.toString()}`);
  return response.data;
}

export async function getOrderBuyers(
  client: ApiClient,
  organizationId: string,
  orderIds: string[],
): Promise<OrderBuyers> {
  const query = new URLSearchParams();
  for (const id of orderIds) query.append('orderId', id);
  const response = await client.get<OrderBuyers>(`${base(organizationId)}/checkins/buyers?${query.toString()}`);
  return response.data;
}

export async function getSalesCustomers(
  client: ApiClient,
  organizationId: string,
  params: SalesStatsParams,
): Promise<SalesCustomers> {
  const response = await client.get<SalesCustomers>(`${base(organizationId)}/orders/customers?${search(params)}`);
  return response.data;
}

export async function getGateNoShows(
  client: ApiClient,
  organizationId: string,
  sessionIds: string[],
): Promise<GateNoShows> {
  const query = new URLSearchParams();
  for (const id of sessionIds) query.append('sessionId', id);
  const response = await client.get<GateNoShows>(`${base(organizationId)}/checkins/no-shows?${query.toString()}`);
  return response.data;
}

/**
 * Xuất danh sách người mua (tên đầy đủ). Mỗi lần gọi để lại một dòng trong nhật ký của tổ chức, và
 * server từ chối nếu không ghi được — nên đây là POST, và KHÔNG được gọi lại tự động khi lỗi.
 */
export async function exportBuyers(
  client: ApiClient,
  organizationId: string,
  sessionIds: string[],
): Promise<BuyerExport> {
  const response = await client.post<BuyerExport>(`${base(organizationId)}/checkins/buyers/export`, { sessionIds });
  return response.data;
}
