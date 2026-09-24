'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getEventMasterData, getOrganizationDashboard } from '../api/dashboard';
import { searchOrganizationTickets } from '../api/organization-tickets';
import { queryKeys, staleTime } from '../query/keys';
import { useApiClient } from '../query/provider';
import type { TicketSearchParams } from '../types/ticketing';

/** Tổng quan: mọi sự kiện của tổ chức kèm số vé và tiền đã bán. */
export function useOrganizationDashboard(organizationId: string | null | undefined) {
  const client = useApiClient();

  return useQuery({
    queryKey: queryKeys.catalog.dashboard(organizationId ?? ''),
    queryFn: () => getOrganizationDashboard(client, organizationId as string),
    enabled: Boolean(organizationId),
    staleTime: staleTime.ADMIN_TABLE,
  });
}

/**
 * Master data của một sự kiện: chi tiết, khu, trạng thái chỗ và số bán theo từng suất.
 *
 * Đây là thứ bộ chọn sự kiện nạp khi người dùng đổi lựa chọn. `keepPreviousData` giữ lại bảng cũ
 * trong lúc bản mới đang về: không có nó thì mỗi lần đổi sự kiện là cả màn hình nháy về khung
 * xương, và bộ chọn nhảy vị trí ngay dưới con trỏ.
 */
export function useEventMasterData(
  organizationId: string | null | undefined,
  eventId: string | null | undefined,
) {
  const client = useApiClient();

  return useQuery({
    queryKey: queryKeys.catalog.masterData(organizationId ?? '', eventId ?? ''),
    queryFn: () => getEventMasterData(client, organizationId as string, eventId as string),
    enabled: Boolean(organizationId) && Boolean(eventId),
    staleTime: staleTime.ADMIN_TABLE,
    placeholderData: keepPreviousData,
  });
}

/**
 * Tra cứu vé.
 *
 * `keepPreviousData` ở đây là bắt buộc chứ không phải tinh chỉnh: bộ lọc đổi theo từng phím gõ,
 * và không có nó thì bảng nháy trắng sau mỗi ký tự.
 */
export function useOrganizationTickets(
  organizationId: string | null | undefined,
  params: TicketSearchParams,
) {
  const client = useApiClient();

  return useQuery({
    queryKey: queryKeys.ticketing.organizationTickets(organizationId ?? '', params),
    queryFn: () => searchOrganizationTickets(client, organizationId as string, params),
    enabled: Boolean(organizationId),
    staleTime: staleTime.ADMIN_TABLE,
    placeholderData: keepPreviousData,
  });
}
