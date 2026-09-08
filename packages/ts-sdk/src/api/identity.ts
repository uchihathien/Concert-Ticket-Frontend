import type { ApiClient } from '../http/client';
import type {
  CreateOrganizationRequest,
  CreatedOrganization,
  InvitationCreated,
  InviteMemberRequest,
  Member,
  OrganizationSummary,
} from '../types/identity';

/**
 * `identity-service` qua api-gateway (`/v1/organizations/**`, `/v1/me/**`, `/v1/invitations/**`,
 * `/v1/platform/organizations`).
 *
 * `/internal/**` cố ý không có route ở gateway — frontend không gọi được và không nên gọi.
 */

export async function getMyOrganizations(client: ApiClient): Promise<OrganizationSummary[]> {
  const response = await client.get<OrganizationSummary[]>('/v1/me/organizations');
  return response.data;
}

export async function getOrganization(
  client: ApiClient,
  organizationId: string,
): Promise<OrganizationSummary> {
  const response = await client.get<OrganizationSummary>(`/v1/organizations/${organizationId}`);
  return response.data;
}

export async function getMembers(client: ApiClient, organizationId: string): Promise<Member[]> {
  const response = await client.get<Member[]>(`/v1/organizations/${organizationId}/members`);
  return response.data;
}

export async function inviteMember(
  client: ApiClient,
  organizationId: string,
  request: InviteMemberRequest,
  idempotencyKey?: string,
): Promise<InvitationCreated> {
  const response = await client.post<InvitationCreated>(
    `/v1/organizations/${organizationId}/invitations`,
    request,
    { idempotencyKey },
  );
  return response.data;
}

export async function acceptInvitation(
  client: ApiClient,
  token: string,
): Promise<OrganizationSummary> {
  const response = await client.post<OrganizationSummary>(
    `/v1/invitations/${encodeURIComponent(token)}/accept`,
  );
  return response.data;
}

/** Danh sách toàn hệ thống — chỉ superadmin. `limit` bị backend chặn trần ở 200. */
export async function listPlatformOrganizations(
  client: ApiClient,
  params: { limit?: number; offset?: number } = {},
): Promise<OrganizationSummary[]> {
  const query = new URLSearchParams({
    limit: String(params.limit ?? 50),
    offset: String(params.offset ?? 0),
  });
  const response = await client.get<OrganizationSummary[]>(
    `/v1/platform/organizations?${query.toString()}`,
  );
  return response.data;
}

export async function createOrganization(
  client: ApiClient,
  request: CreateOrganizationRequest,
  idempotencyKey?: string,
): Promise<CreatedOrganization> {
  const response = await client.post<CreatedOrganization>('/v1/platform/organizations', request, {
    idempotencyKey,
  });
  return response.data;
}
