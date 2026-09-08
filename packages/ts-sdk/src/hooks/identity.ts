'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  acceptInvitation,
  createOrganization,
  getMembers,
  getMyOrganizations,
  getOrganization,
  inviteMember,
  listPlatformOrganizations,
} from '../api/identity';
import { useApiClient } from '../query/provider';
import { queryKeys, staleTime } from '../query/keys';
import type {
  CreateOrganizationRequest,
  InviteMemberRequest,
  OrganizationSummary,
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
