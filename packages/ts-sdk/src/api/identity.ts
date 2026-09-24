import type { ApiClient } from '../http/client';
import type {
  AuditEntry,
  AuditLogParams,
  CreateOrganizationRequest,
  CreatedOrganization,
  GrantMemberRequest,
  GrantMemberResult,
  InvitationCreated,
  InviteMemberRequest,
  Member,
  MyPermissions,
  OrganizationRole,
  OrganizationSummary,
  PendingInvitation,
  RoleView,
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

/* ---------------------------------------------------------------------------
 * Phân quyền, quản lý thành viên, phiên đăng nhập và nhật ký kiểm toán.
 * ------------------------------------------------------------------------- */

/** Ma trận vai trò → quyền. Hằng số của hệ thống, nhưng vẫn đọc từ API để app không chép lại nó. */
export async function getRoles(client: ApiClient): Promise<RoleView[]> {
  const response = await client.get<RoleView[]>('/v1/roles');
  return response.data;
}

/** Quyền của chính người đang đăng nhập, theo từng tổ chức. */
export async function getMyPermissions(client: ApiClient): Promise<MyPermissions> {
  const response = await client.get<MyPermissions>('/v1/me/permissions');
  return response.data;
}

/**
 * Đổi tên hiển thị của tổ chức. Slug **không** đổi theo.
 *
 * Cố ý: slug đã nằm trong đường dẫn công khai của sự kiện và trong liên kết khách đã lưu. Đổi tên
 * là việc thường (sai chính tả, đổi thương hiệu); đổi slug thì làm chết liên kết cũ, nên nó phải
 * là một quyết định riêng chứ không phải hệ quả âm thầm của một lần sửa lỗi gõ.
 */
export async function renameOrganization(
  client: ApiClient,
  organizationId: string,
  name: string,
): Promise<OrganizationSummary> {
  const response = await client.patch<OrganizationSummary>(`/v1/organizations/${organizationId}`, {
    name,
  });
  return response.data;
}

export async function changeMemberRole(
  client: ApiClient,
  organizationId: string,
  userId: string,
  role: OrganizationRole,
): Promise<Member[]> {
  const response = await client.patch<Member[]>(
    `/v1/organizations/${organizationId}/members/${userId}`,
    { role },
  );
  return response.data;
}

export async function removeMember(
  client: ApiClient,
  organizationId: string,
  userId: string,
): Promise<Member[]> {
  const response = await client.delete<Member[]>(
    `/v1/organizations/${organizationId}/members/${userId}`,
  );
  return response.data;
}

/**
 * Buộc một thành viên đăng xuất khỏi mọi thiết bị.
 *
 * Khác với việc gỡ họ khỏi tổ chức: gỡ thành viên có hiệu lực ngay vì backend tra membership ở mỗi
 * request. Lệnh này lo phần danh tính — access token đã phát vẫn sống tới 15 phút nếu không có nó.
 */
export async function revokeMemberSessions(
  client: ApiClient,
  organizationId: string,
  userId: string,
  reason?: string,
): Promise<void> {
  const query = reason ? `?reason=${encodeURIComponent(reason)}` : '';
  await client.delete<void>(
    `/v1/organizations/${organizationId}/members/${userId}/sessions${query}`,
  );
}

/**
 * Nhờ Keycloak gửi thư đặt lại mật khẩu cho một thành viên.
 *
 * Đây là đường **thứ hai**: đường chính là người dùng tự bấm "Quên mật khẩu?" trên trang đăng nhập
 * của Keycloak. Dùng khi họ không tự làm được — gõ sai email lúc đăng ký, hoặc hộp thư chung không
 * ai đọc.
 *
 * Không trả về liên kết đặt lại, và đó là cố ý: trả về nghĩa là quản trị viên cầm được chìa khoá
 * vào tài khoản của nhân viên.
 */
export async function sendMemberPasswordReset(
  client: ApiClient,
  organizationId: string,
  userId: string,
): Promise<void> {
  await client.post<void>(`/v1/organizations/${organizationId}/members/${userId}/password-reset`);
}

export async function getPendingInvitations(
  client: ApiClient,
  organizationId: string,
): Promise<PendingInvitation[]> {
  const response = await client.get<PendingInvitation[]>(
    `/v1/organizations/${organizationId}/invitations`,
  );
  return response.data;
}

export async function revokeInvitation(
  client: ApiClient,
  organizationId: string,
  invitationId: string,
): Promise<void> {
  await client.delete<void>(`/v1/organizations/${organizationId}/invitations/${invitationId}`);
}

export async function getAuditLogs(
  client: ApiClient,
  organizationId: string,
  params: AuditLogParams = {},
): Promise<AuditEntry[]> {
  const response = await client.get<AuditEntry[]>(
    `/v1/organizations/${organizationId}/audit-logs?${auditQuery(params)}`,
  );
  return response.data;
}

/** Nhật ký xuyên tổ chức — chỉ superadmin. */
export async function getPlatformAuditLogs(
  client: ApiClient,
  params: AuditLogParams = {},
): Promise<AuditEntry[]> {
  const response = await client.get<AuditEntry[]>(`/v1/platform/audit-logs?${auditQuery(params)}`);
  return response.data;
}

/** Nền tảng gắn thẳng một người vào tổ chức; rơi về lời mời nếu họ chưa từng đăng nhập. */
export async function grantMember(
  client: ApiClient,
  organizationId: string,
  request: GrantMemberRequest,
  idempotencyKey?: string,
): Promise<GrantMemberResult> {
  const response = await client.post<GrantMemberResult>(
    `/v1/platform/organizations/${organizationId}/members`,
    request,
    { idempotencyKey },
  );
  return response.data;
}

export async function suspendOrganization(
  client: ApiClient,
  organizationId: string,
): Promise<OrganizationSummary> {
  const response = await client.post<OrganizationSummary>(
    `/v1/platform/organizations/${organizationId}/suspend`,
  );
  return response.data;
}

export async function activateOrganization(
  client: ApiClient,
  organizationId: string,
): Promise<OrganizationSummary> {
  const response = await client.post<OrganizationSummary>(
    `/v1/platform/organizations/${organizationId}/activate`,
  );
  return response.data;
}

/**
 * Tham số nào rỗng thì **bỏ hẳn** khỏi query string.
 *
 * `action=` (chuỗi rỗng) không giống `action` vắng mặt: phía backend đọc nó thành chuỗi rỗng chứ
 * không phải null, và bộ lọc `action = ''` không khớp dòng nào — màn hình trống trong khi nhật ký
 * đầy dữ liệu.
 */
function auditQuery(params: AuditLogParams): string {
  const query = new URLSearchParams({
    limit: String(params.limit ?? 50),
    offset: String(params.offset ?? 0),
  });
  if (params.action) query.set('action', params.action);
  return query.toString();
}
