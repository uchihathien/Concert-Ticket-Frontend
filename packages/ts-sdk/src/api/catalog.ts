import type { ApiClient } from '../http/client';
import type {
  AdminEventDetail,
  AdminEventRow,
  AdminVenue,
  AdminZone,
  CreateEventRequest,
  CreateSessionRequest,
  CreateTicketTypeRequest,
  CreateVenueRequest,
  CreateZoneRequest,
  UpdateEventRequest,
  UpdateSessionRequest,
  UpdateTicketTypeRequest,
} from '../types/catalog';

/**
 * Khu quản trị của `catalog-service`.
 *
 * Mọi đường dẫn đều mang `organizationId`: đó là thứ `TenantFilter` dùng để kiểm thành viên và
 * trả 404 nếu không phải. Bỏ nó đi thì người thuộc nhiều tổ chức sẽ im lặng thao tác nhầm chỗ.
 */

const base = (organizationId: string) => `/v1/organizations/${organizationId}`;

export async function listVenues(client: ApiClient, organizationId: string): Promise<AdminVenue[]> {
  const response = await client.get<AdminVenue[]>(`${base(organizationId)}/venues`);
  return response.data;
}

export async function createVenue(
  client: ApiClient,
  organizationId: string,
  request: CreateVenueRequest,
  idempotencyKey?: string,
): Promise<AdminVenue> {
  const response = await client.post<AdminVenue>(`${base(organizationId)}/venues`, request, {
    idempotencyKey,
  });
  return response.data;
}

export async function createZone(
  client: ApiClient,
  organizationId: string,
  venueId: string,
  request: CreateZoneRequest,
  idempotencyKey?: string,
): Promise<AdminZone> {
  const response = await client.post<AdminZone>(
    `${base(organizationId)}/venues/${venueId}/zones`,
    request,
    { idempotencyKey },
  );
  return response.data;
}

export async function listEvents(
  client: ApiClient,
  organizationId: string,
): Promise<AdminEventRow[]> {
  const response = await client.get<AdminEventRow[]>(`${base(organizationId)}/events`);
  return response.data;
}

export async function getEvent(
  client: ApiClient,
  organizationId: string,
  eventId: string,
): Promise<AdminEventDetail> {
  const response = await client.get<AdminEventDetail>(`${base(organizationId)}/events/${eventId}`);
  return response.data;
}

export async function createEvent(
  client: ApiClient,
  organizationId: string,
  request: CreateEventRequest,
  idempotencyKey?: string,
): Promise<AdminEventDetail> {
  const response = await client.post<AdminEventDetail>(`${base(organizationId)}/events`, request, {
    idempotencyKey,
  });
  return response.data;
}

export async function updateEvent(
  client: ApiClient,
  organizationId: string,
  eventId: string,
  request: UpdateEventRequest,
): Promise<AdminEventDetail> {
  const response = await client.request<AdminEventDetail>(
    `${base(organizationId)}/events/${eventId}`,
    { method: 'PATCH', body: request },
  );
  return response.data;
}

export async function createSession(
  client: ApiClient,
  organizationId: string,
  eventId: string,
  request: CreateSessionRequest,
  idempotencyKey?: string,
): Promise<AdminEventDetail> {
  const response = await client.post<AdminEventDetail>(
    `${base(organizationId)}/events/${eventId}/sessions`,
    request,
    { idempotencyKey },
  );
  return response.data;
}

export async function createTicketType(
  client: ApiClient,
  organizationId: string,
  eventId: string,
  sessionId: string,
  request: CreateTicketTypeRequest,
  idempotencyKey?: string,
): Promise<AdminEventDetail> {
  const response = await client.post<AdminEventDetail>(
    `${base(organizationId)}/events/${eventId}/sessions/${sessionId}/ticket-types`,
    request,
    { idempotencyKey },
  );
  return response.data;
}

export async function updateSession(
  client: ApiClient,
  organizationId: string,
  eventId: string,
  sessionId: string,
  request: UpdateSessionRequest,
): Promise<AdminEventDetail> {
  const response = await client.request<AdminEventDetail>(
    `${base(organizationId)}/events/${eventId}/sessions/${sessionId}`,
    { method: 'PATCH', body: request },
  );
  return response.data;
}

export async function deleteSession(
  client: ApiClient,
  organizationId: string,
  eventId: string,
  sessionId: string,
): Promise<AdminEventDetail> {
  const response = await client.delete<AdminEventDetail>(
    `${base(organizationId)}/events/${eventId}/sessions/${sessionId}`,
  );
  return response.data;
}

export async function updateTicketType(
  client: ApiClient,
  organizationId: string,
  eventId: string,
  sessionId: string,
  ticketTypeId: string,
  request: UpdateTicketTypeRequest,
): Promise<AdminEventDetail> {
  const response = await client.request<AdminEventDetail>(
    `${base(organizationId)}/events/${eventId}/sessions/${sessionId}/ticket-types/${ticketTypeId}`,
    { method: 'PATCH', body: request },
  );
  return response.data;
}

export async function deleteTicketType(
  client: ApiClient,
  organizationId: string,
  eventId: string,
  sessionId: string,
  ticketTypeId: string,
): Promise<AdminEventDetail> {
  const response = await client.delete<AdminEventDetail>(
    `${base(organizationId)}/events/${eventId}/sessions/${sessionId}/ticket-types/${ticketTypeId}`,
  );
  return response.data;
}

/** Cả hai đều trả về chi tiết sự kiện sau khi đổi, nên UI không phải gọi lại để đọc trạng thái. */
export async function publishEvent(
  client: ApiClient,
  organizationId: string,
  eventId: string,
): Promise<AdminEventDetail> {
  const response = await client.post<AdminEventDetail>(
    `${base(organizationId)}/events/${eventId}/publish`,
  );
  return response.data;
}

export async function unpublishEvent(
  client: ApiClient,
  organizationId: string,
  eventId: string,
): Promise<AdminEventDetail> {
  const response = await client.post<AdminEventDetail>(
    `${base(organizationId)}/events/${eventId}/unpublish`,
  );
  return response.data;
}
