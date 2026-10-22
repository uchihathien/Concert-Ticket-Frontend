import type { ApiClient } from '../http/client';
import type {
  CheckinBundle,
  CheckinBundleTicket,
  CheckinConflict,
  CheckinGate,
  CheckinHistory,
  CheckinShift,
  CheckinShiftRequest,
  MyShift,
  OfflineScanItem,
  ShiftHandover,
  SyncResult,
  CheckinSession,
  GateScanRequest,
  GateScanResponse,
  ListMyTicketsParams,
  ScanRequest,
  ScanResponse,
  Ticket,
} from '../types/ticketing';

/**
 * Soát vé.
 *
 * Backend **luôn trả 200**, kể cả khi vé bị từ chối — nên hàm này không ném lỗi cho vé sai, và
 * nơi gọi phải rẽ nhánh theo `result`. Chỉ lỗi mạng, 401 hay 5xx mới thành `ApiError`.
 *
 * Tổ chức của nhân viên lấy từ token đăng nhập ở phía backend, không gửi lên từ client: để client
 * gửi thì ai cũng soát được vé của tổ chức khác bằng cách đổi một trường JSON.
 */
export async function scanTicket(
  client: ApiClient,
  eventSessionId: string,
  request: ScanRequest,
): Promise<ScanResponse> {
  const response = await client.post<ScanResponse>(
    `/v1/sessions/${eventSessionId}/checkins`,
    request,
  );
  return response.data;
}

/** Session list for one organization; the backend enforces CHECKIN_SCAN membership. */
export async function listCheckinSessions(
  client: ApiClient,
  organizationId: string,
): Promise<CheckinSession[]> {
  const response = await client.get<CheckinSession[]>(
    `/v1/organizations/${encodeURIComponent(organizationId)}/checkin-sessions`,
  );
  return response.data;
}

/** Check in on an explicit organization path so multi-organization staff get the correct tenant scope. */
export async function scanTicketForOrganization(
  client: ApiClient,
  organizationId: string,
  eventSessionId: string,
  request: ScanRequest,
): Promise<ScanResponse> {
  const response = await client.post<ScanResponse>(
    `/v1/organizations/${encodeURIComponent(organizationId)}/sessions/${encodeURIComponent(eventSessionId)}/checkins`,
    request,
  );
  return response.data;
}

function checkinsPath(organizationId: string, eventSessionId: string): string {
  return `/v1/organizations/${encodeURIComponent(organizationId)}/sessions/${encodeURIComponent(eventSessionId)}/checkins`;
}

/**
 * Một lượt quét ở cửa có hướng Vào / Ra.
 *
 * Như `scanTicket`: backend luôn trả 200 và nơi gọi rẽ nhánh theo `result`. Ngoại lệ duy nhất là
 * cho vào thủ công (`override`) mà thiếu quyền hoặc thiếu lý do — khi đó là `ApiError` 403 / 400.
 */
export async function scanAtGate(
  client: ApiClient,
  organizationId: string,
  eventSessionId: string,
  request: GateScanRequest,
): Promise<GateScanResponse> {
  const response = await client.post<GateScanResponse>(
    checkinsPath(organizationId, eventSessionId),
    request,
  );
  return response.data;
}

/** Lịch sử quét của suất đang soát, kèm số khách đang ở trong và tổng đã check-in. */
export async function getCheckinHistory(
  client: ApiClient,
  organizationId: string,
  eventSessionId: string,
  params: { query?: string; page?: number; size?: number } = {},
): Promise<CheckinHistory> {
  const search = new URLSearchParams();
  if (params.query?.trim()) search.set('query', params.query.trim());
  if (params.page !== undefined) search.set('page', String(params.page));
  if (params.size !== undefined) search.set('size', String(params.size));
  const suffix = search.toString();
  const response = await client.get<CheckinHistory>(
    `${checkinsPath(organizationId, eventSessionId)}${suffix ? `?${suffix}` : ''}`,
  );
  return response.data;
}

/** Ví vé của chính mình. Backend kẹp `limit` ở 100. */
export async function listMyTickets(
  client: ApiClient,
  params: ListMyTicketsParams = {},
): Promise<Ticket[]> {
  const search = new URLSearchParams();
  if (params.limit !== undefined) search.set('limit', String(params.limit));
  if (params.offset !== undefined) search.set('offset', String(params.offset));

  const query = search.toString();
  const response = await client.get<Ticket[]>(`/v1/me/tickets${query ? `?${query}` : ''}`);
  return response.data;
}

/** Vé của một đơn. Đơn của người khác trả 404, không phải 403. */
export async function listOrderTickets(client: ApiClient, orderId: string): Promise<Ticket[]> {
  const response = await client.get<Ticket[]>(`/v1/orders/${encodeURIComponent(orderId)}/tickets`);
  return response.data;
}

/* ---------------------------------------------------------------------------
 * Ca trực — `/v1/organizations/{id}/checkin/...`
 * ------------------------------------------------------------------------- */

function checkinBase(organizationId: string): string {
  return `/v1/organizations/${encodeURIComponent(organizationId)}/checkin`;
}

export async function listCheckinGates(
  client: ApiClient,
  organizationId: string,
  eventId: string,
): Promise<CheckinGate[]> {
  const response = await client.get<CheckinGate[]>(
    `${checkinBase(organizationId)}/events/${encodeURIComponent(eventId)}/gates`,
  );
  return response.data;
}

export async function createCheckinGate(
  client: ApiClient,
  organizationId: string,
  eventId: string,
  name: string,
): Promise<CheckinGate> {
  const response = await client.post<CheckinGate>(
    `${checkinBase(organizationId)}/events/${encodeURIComponent(eventId)}/gates`,
    { name },
  );
  return response.data;
}

export async function renameCheckinGate(
  client: ApiClient,
  organizationId: string,
  gateId: string,
  name: string,
): Promise<void> {
  await client.put<void>(`${checkinBase(organizationId)}/gates/${encodeURIComponent(gateId)}`, { name });
}

/** Cổng còn ca thì trả 409 `GATE_IN_USE`. */
export async function deleteCheckinGate(client: ApiClient, organizationId: string, gateId: string): Promise<void> {
  await client.delete<void>(`${checkinBase(organizationId)}/gates/${encodeURIComponent(gateId)}`);
}

export async function listEventShifts(
  client: ApiClient,
  organizationId: string,
  eventId: string,
): Promise<CheckinShift[]> {
  const response = await client.get<CheckinShift[]>(
    `${checkinBase(organizationId)}/events/${encodeURIComponent(eventId)}/shifts`,
  );
  return response.data;
}

export async function createShift(
  client: ApiClient,
  organizationId: string,
  request: CheckinShiftRequest,
): Promise<CheckinShift> {
  const response = await client.post<CheckinShift>(`${checkinBase(organizationId)}/shifts`, request);
  return response.data;
}

export async function updateShift(
  client: ApiClient,
  organizationId: string,
  shiftId: string,
  request: CheckinShiftRequest,
): Promise<CheckinShift> {
  const response = await client.put<CheckinShift>(
    `${checkinBase(organizationId)}/shifts/${encodeURIComponent(shiftId)}`,
    request,
  );
  return response.data;
}

export async function deleteShift(client: ApiClient, organizationId: string, shiftId: string): Promise<void> {
  await client.delete<void>(`${checkinBase(organizationId)}/shifts/${encodeURIComponent(shiftId)}`);
}

/** Ca hôm nay và sắp tới của chính người gọi. */
export async function listMyShifts(client: ApiClient, organizationId: string): Promise<MyShift[]> {
  const response = await client.get<MyShift[]>(`${checkinBase(organizationId)}/my-shifts`);
  return response.data;
}

export async function startShift(
  client: ApiClient,
  organizationId: string,
  shiftId: string,
  deviceId?: string,
): Promise<MyShift> {
  const response = await client.post<MyShift>(
    `${checkinBase(organizationId)}/shifts/${encodeURIComponent(shiftId)}/start`,
    { deviceId },
  );
  return response.data;
}

export async function endShift(client: ApiClient, organizationId: string, shiftId: string): Promise<ShiftHandover> {
  const response = await client.post<ShiftHandover>(
    `${checkinBase(organizationId)}/shifts/${encodeURIComponent(shiftId)}/end`,
  );
  return response.data;
}

/* ---------------------------------------------------------------------------
 * Soát vé offline + tìm khách — `.../sessions/{id}/checkins/{bundle,sync,lookup,conflicts}`
 * ------------------------------------------------------------------------- */

/** Gói dữ liệu soát vé của suất. `since` (= `serverTime` lần trước) để chỉ tải phần đổi. */
export async function getCheckinBundle(
  client: ApiClient,
  organizationId: string,
  eventSessionId: string,
  since?: string,
): Promise<CheckinBundle> {
  const query = since ? `?since=${encodeURIComponent(since)}` : '';
  const response = await client.get<CheckinBundle>(`${checkinsPath(organizationId, eventSessionId)}/bundle${query}`);
  return response.data;
}

/** Gửi lô lượt quét offline (tối đa 500). Gửi lại cùng `clientScanId` không ghi lần hai. */
export async function syncOfflineScans(
  client: ApiClient,
  organizationId: string,
  eventSessionId: string,
  scans: OfflineScanItem[],
): Promise<SyncResult> {
  const response = await client.post<SyncResult>(`${checkinsPath(organizationId, eventSessionId)}/sync`, { scans });
  return response.data;
}

/** Tìm khách trong suất theo tên (không dấu), email, SĐT hoặc mã vé. Tối đa 20 dòng, đã che. */
export async function lookupTickets(
  client: ApiClient,
  organizationId: string,
  eventSessionId: string,
  query: string,
): Promise<CheckinBundleTicket[]> {
  const response = await client.get<CheckinBundleTicket[]>(
    `${checkinsPath(organizationId, eventSessionId)}/lookup?q=${encodeURIComponent(query)}`,
  );
  return response.data;
}

/** Cho vào bằng tra cứu sau khi đối chiếu giấy tờ. Backend trả 200 kèm kết quả như một lượt quét. */
export async function admitByLookup(
  client: ApiClient,
  organizationId: string,
  eventSessionId: string,
  request: { ticketId: string; identityChecked: boolean; deviceId?: string },
): Promise<GateScanResponse> {
  const response = await client.post<GateScanResponse>(`${checkinsPath(organizationId, eventSessionId)}/lookup`, request);
  return response.data;
}

export async function listCheckinConflicts(
  client: ApiClient,
  organizationId: string,
  eventSessionId: string,
): Promise<CheckinConflict[]> {
  const response = await client.get<CheckinConflict[]>(`${checkinsPath(organizationId, eventSessionId)}/conflicts`);
  return response.data;
}
