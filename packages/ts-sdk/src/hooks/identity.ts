'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  acceptInvitation,
  activateOrganization,
  changeMemberRole,
  createOrganization,
  getAuditLogs,
  getMembers,
  getMyOrganizations,
  getMyPermissions,
  getOrganization,
  getPendingInvitations,
  getPlatformAuditLogs,
  getRoles,
  grantMember,
  inviteMember,
  listPlatformOrganizations,
  removeMember,
  renameOrganization,
  revokeInvitation,
  revokeMemberSessions,
  sendMemberPasswordReset,
  suspendOrganization,
} from '../api/identity';
import { useApiClient } from '../query/provider';
import { queryKeys, staleTime } from '../query/keys';
import type {
  AuditLogParams,
  CreateOrganizationRequest,
  GrantMemberRequest,
  InviteMemberRequest,
  OrganizationRole,
  OrganizationSummary,
  Permission,
} from '../types/identity';

export function useMyOrganizations() {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.identity.myOrganizations(),
    queryFn: () => getMyOrganizations(client),
    staleTime: staleTime.ADMIN_TABLE,
  });
}

export function useOrganization(organizationId: string | null | undefined) {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.identity.organization(organizationId ?? ''),
    queryFn: () => getOrganization(client, organizationId as string),
    enabled: Boolean(organizationId),
    staleTime: staleTime.ADMIN_TABLE,
  });
}

export function useOrganizationMembers(organizationId: string | null | undefined) {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.identity.members(organizationId ?? ''),
    queryFn: () => getMembers(client, organizationId as string),
    enabled: Boolean(organizationId),
    staleTime: staleTime.ADMIN_TABLE,
  });
}

export function useInviteMember(organizationId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: InviteMemberRequest & { idempotencyKey?: string }) =>
      inviteMember(
        client,
        organizationId,
        { email: input.email, role: input.role },
        input.idempotencyKey,
      ),
    onSuccess: () => {
      // Lời mời chưa tạo ra thành viên, nhưng A-MEMBERS hiện cả danh sách chờ nên vẫn phải làm mới.
      void queryClient.invalidateQueries({ queryKey: queryKeys.identity.members(organizationId) });
    },
  });
}

export function useAcceptInvitation() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (token: string) => acceptInvitation(client, token),
    onSuccess: (organization: OrganizationSummary) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.identity.myOrganizations() });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.identity.organization(organization.id),
      });
    },
  });
}

/** Chỉ dùng ở `web-platform`. Backend chặn trần `limit` ở 200. */
export function usePlatformOrganizations(params: { limit?: number; offset?: number } = {}) {
  const client = useApiClient();
  const normalized = { limit: params.limit ?? 50, offset: params.offset ?? 0 };

  return useQuery({
    queryKey: queryKeys.identity.platformOrganizations(normalized),
    queryFn: () => listPlatformOrganizations(client, normalized),
    staleTime: staleTime.ADMIN_TABLE,
  });
}

export function useCreateOrganization() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateOrganizationRequest & { idempotencyKey?: string }) => {
      const { idempotencyKey, ...request } = input;
      return createOrganization(client, request, idempotencyKey);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['identity', 'platform', 'organizations'] });
    },
  });
}

/**
 * Đổi tên tổ chức.
 *
 * Làm mới cả danh sách nền tảng lẫn `myOrganizations`: cùng một cái tên xuất hiện ở bảng của
 * superadmin, ở ô chọn tổ chức của `web-admin` và ở tiêu đề màn chi tiết. Bỏ sót một chỗ thì màn
 * hình còn lại hiện tên cũ và người dùng tưởng lệnh đổi tên đã trượt.
 */
export function useRenameOrganization(organizationId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => renameOrganization(client, organizationId, name),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.identity.organization(organizationId),
      });
      void queryClient.invalidateQueries({ queryKey: ['identity', 'platform', 'organizations'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.identity.myOrganizations() });
    },
  });
}

/* ---------------------------------------------------------------------------
 * Phân quyền, quản lý thành viên, phiên đăng nhập, nhật ký kiểm toán.
 * ------------------------------------------------------------------------- */

/**
 * Ma trận vai trò → quyền.
 *
 * `staleTime: Infinity` vì đây là hằng số của hệ thống: nó chỉ đổi khi backend được triển khai bản
 * mới, và khi đó cả trang cũng được tải lại.
 */
export function useRoles() {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.identity.roles(),
    queryFn: () => getRoles(client),
    staleTime: Infinity,
  });
}

/**
 * Quyền của người đang đăng nhập.
 *
 * Dùng để ẩn/hiện nút, KHÔNG phải để chặn: chặn thật nằm ở backend và vẫn chạy dù giao diện có hỏi
 * hay không. Ẩn một nút người dùng không bấm được là để họ khỏi đâm vào cánh cửa khoá, chứ không
 * phải để khoá cánh cửa đó.
 */
export function useMyPermissions() {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.identity.myPermissions(),
    queryFn: () => getMyPermissions(client),
    staleTime: staleTime.ADMIN_TABLE,
  });
}

/**
 * Người này có quyền `permission` ở tổ chức `organizationId` không.
 *
 * Trả `false` khi chưa tải xong — mặc định an toàn: hiện một nút rồi giấu đi khi dữ liệu về sẽ làm
 * giao diện nhấp nháy, và tệ hơn là mời người dùng bấm vào thứ họ không được phép.
 */
export function useHasPermission(
  permission: Permission,
  organizationId: string | null | undefined,
): boolean {
  const { data } = useMyPermissions();
  if (!data) return false;
  if (data.superAdmin) {
    // Cùng luật với `TenantContext` ở backend: superadmin đi qua được mọi cửa của tổ chức. Quyền
    // phạm vi nền tảng thì vẫn phải nằm trong danh sách của chính họ.
    return permission.startsWith('PLATFORM_')
      ? data.platformPermissions.includes(permission)
      : true;
  }
  if (!organizationId) return false;
  return (data.organizations[organizationId] ?? []).includes(permission);
}

export function useChangeMemberRole(organizationId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { userId: string; role: OrganizationRole }) =>
      changeMemberRole(client, organizationId, input.userId, input.role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.identity.members(organizationId) });
      // Quyền trên màn hình có thể đổi theo: backend chặn việc tự đổi vai trò của mình, nhưng
      // superadmin thì không bị chặn.
      void queryClient.invalidateQueries({ queryKey: queryKeys.identity.myPermissions() });
    },
  });
}

export function useRemoveMember(organizationId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => removeMember(client, organizationId, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.identity.members(organizationId) });
    },
  });
}

/**
 * Buộc một thành viên đăng xuất khỏi mọi thiết bị.
 *
 * Không làm mới danh sách nào: thao tác này không đổi gì trong dữ liệu màn hình đang hiện — người
 * đó vẫn là thành viên, vẫn giữ nguyên vai trò. Thứ đổi là phiên đăng nhập của họ, và bảng thành
 * viên không hiển thị phiên.
 */
export function useRevokeMemberSessions(organizationId: string) {
  const client = useApiClient();
  return useMutation({
    mutationFn: (input: { userId: string; reason?: string }) =>
      revokeMemberSessions(client, organizationId, input.userId, input.reason),
  });
}

/** Nhờ Keycloak gửi thư đặt lại mật khẩu. Không trả về liên kết — nó đi thẳng tới hộp thư. */
export function useSendMemberPasswordReset(organizationId: string) {
  const client = useApiClient();
  return useMutation({
    mutationFn: (userId: string) => sendMemberPasswordReset(client, organizationId, userId),
  });
}

export function usePendingInvitations(organizationId: string | null | undefined) {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.identity.invitations(organizationId ?? ''),
    queryFn: () => getPendingInvitations(client, organizationId as string),
    enabled: Boolean(organizationId),
    staleTime: staleTime.ADMIN_TABLE,
  });
}

export function useRevokeInvitation(organizationId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: string) => revokeInvitation(client, organizationId, invitationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.identity.invitations(organizationId),
      });
    },
  });
}

export function useAuditLogs(
  organizationId: string | null | undefined,
  params: AuditLogParams = {},
) {
  const client = useApiClient();
  const normalized = {
    action: params.action ?? null,
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
  };

  return useQuery({
    queryKey: queryKeys.identity.auditLogs(organizationId ?? '', normalized),
    queryFn: () => getAuditLogs(client, organizationId as string, normalized),
    enabled: Boolean(organizationId),
    staleTime: staleTime.ADMIN_TABLE,
  });
}

/** Chỉ dùng ở `web-platform`. */
export function usePlatformAuditLogs(params: AuditLogParams = {}) {
  const client = useApiClient();
  const normalized = {
    action: params.action ?? null,
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
  };

  return useQuery({
    queryKey: queryKeys.identity.platformAuditLogs(normalized),
    queryFn: () => getPlatformAuditLogs(client, normalized),
    staleTime: staleTime.ADMIN_TABLE,
  });
}

/** Chỉ dùng ở `web-platform`: nền tảng gắn thẳng một người vào tổ chức. */
export function useGrantMember(organizationId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: GrantMemberRequest & { idempotencyKey?: string }) =>
      grantMember(
        client,
        organizationId,
        { email: input.email, role: input.role },
        input.idempotencyKey,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.identity.members(organizationId) });
      void queryClient.invalidateQueries({ queryKey: ['identity', 'platform', 'organizations'] });
    },
  });
}

/** Khoá / mở khoá tổ chức — chỉ superadmin. Khoá KHÔNG dừng việc bán vé đang diễn ra. */
export function useOrganizationLifecycle() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { organizationId: string; action: 'suspend' | 'activate' }) =>
      input.action === 'suspend'
        ? suspendOrganization(client, input.organizationId)
        : activateOrganization(client, input.organizationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['identity', 'platform', 'organizations'] });
    },
  });
}
