'use client';

import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import {
  exportBuyers,
  getGateNoShows,
  getSalesCustomers,
  getGateActivity,
  getGatePresence,
  getInventoryStock,
  getOrderBuyers,
  getSalesBreakdown,
  getSalesDistribution,
  getSalesHeatmap,
  getSalesSeries,
  getSalesSummary,
  getStatsOrders,
  getStatsSessions,
} from '../api/stats';
import { queryKeys, staleTime } from '../query/keys';
import { useApiClient } from '../query/provider';
import type { SalesStatsParams, StatsBucket, StatsOrderListParams } from '../types/stats';

/*
 * Mọi hook theo kỳ bật `keepPreviousData`: đổi bộ lọc thì số cũ ở lại (mờ đi) cho tới khi số mới
 * về. Không có nó, mỗi lần đổi bộ lọc là cả trang nháy về khung xương rồi nhảy chỗ.
 */

export function useSalesSummary(
  organizationId: string | null | undefined,
  params: SalesStatsParams,
  compare: boolean,
) {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.stats.salesSummary(organizationId ?? '', params, compare),
    queryFn: () => getSalesSummary(client, organizationId as string, params, compare),
    enabled: Boolean(organizationId),
    staleTime: staleTime.ADMIN_TABLE,
    placeholderData: keepPreviousData,
  });
}

export function useSalesSeries(
  organizationId: string | null | undefined,
  params: SalesStatsParams,
  bucket: StatsBucket,
  compare: boolean,
) {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.stats.salesSeries(organizationId ?? '', params, bucket, compare),
    queryFn: () => getSalesSeries(client, organizationId as string, params, bucket, compare),
    enabled: Boolean(organizationId),
    staleTime: staleTime.ADMIN_TABLE,
    placeholderData: keepPreviousData,
  });
}

export function useSalesBreakdown(
  organizationId: string | null | undefined,
  params: SalesStatsParams,
) {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.stats.salesBreakdown(organizationId ?? '', params),
    queryFn: () => getSalesBreakdown(client, organizationId as string, params),
    enabled: Boolean(organizationId),
    staleTime: staleTime.ADMIN_TABLE,
    placeholderData: keepPreviousData,
  });
}

export function useSalesHeatmap(
  organizationId: string | null | undefined,
  params: SalesStatsParams,
) {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.stats.salesHeatmap(organizationId ?? '', params),
    queryFn: () => getSalesHeatmap(client, organizationId as string, params),
    enabled: Boolean(organizationId),
    staleTime: staleTime.ADMIN_TABLE,
    placeholderData: keepPreviousData,
  });
}

export function useInventoryStock(organizationId: string | null | undefined) {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.stats.inventoryStock(organizationId ?? ''),
    queryFn: () => getInventoryStock(client, organizationId as string),
    enabled: Boolean(organizationId),
    staleTime: staleTime.ADMIN_TABLE,
  });
}

export function useGatePresence(organizationId: string | null | undefined) {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.stats.gatePresence(organizationId ?? ''),
    queryFn: () => getGatePresence(client, organizationId as string),
    enabled: Boolean(organizationId),
    staleTime: staleTime.ADMIN_TABLE,
  });
}

export function useSalesDistribution(organizationId: string | null | undefined, params: SalesStatsParams) {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.stats.salesDistribution(organizationId ?? '', params),
    queryFn: () => getSalesDistribution(client, organizationId as string, params),
    enabled: Boolean(organizationId),
    staleTime: staleTime.ADMIN_TABLE,
    placeholderData: keepPreviousData,
  });
}

export function useStatsOrders(organizationId: string | null | undefined, params: StatsOrderListParams) {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.stats.orders(organizationId ?? '', params),
    queryFn: () => getStatsOrders(client, organizationId as string, params),
    enabled: Boolean(organizationId),
    staleTime: staleTime.ADMIN_TABLE,
    placeholderData: keepPreviousData,
  });
}

/** Danh bạ suất diễn: gần như không đổi trong một phiên làm việc, nên giữ lâu hơn bảng số liệu. */
export function useStatsSessions(organizationId: string | null | undefined) {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.stats.sessions(organizationId ?? ''),
    queryFn: () => getStatsSessions(client, organizationId as string),
    enabled: Boolean(organizationId),
    staleTime: 5 * 60_000,
  });
}

export function useGateActivity(
  organizationId: string | null | undefined,
  params: { from: string; to: string; sessionIds?: string[] },
  enabled = true,
) {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.stats.gateActivity(organizationId ?? '', params),
    queryFn: () => getGateActivity(client, organizationId as string, params),
    enabled: Boolean(organizationId) && enabled,
    staleTime: staleTime.ADMIN_TABLE,
    placeholderData: keepPreviousData,
  });
}

/** Tên người mua (đã che) cho đúng các đơn của trang đang xem. */
export function useOrderBuyers(organizationId: string | null | undefined, orderIds: string[]) {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.stats.buyers(organizationId ?? '', orderIds),
    queryFn: () => getOrderBuyers(client, organizationId as string, orderIds),
    enabled: Boolean(organizationId) && orderIds.length > 0,
    staleTime: staleTime.ADMIN_TABLE,
  });
}

export function useSalesCustomers(organizationId: string | null | undefined, params: SalesStatsParams) {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.stats.customers(organizationId ?? '', params),
    queryFn: () => getSalesCustomers(client, organizationId as string, params),
    enabled: Boolean(organizationId),
    staleTime: staleTime.ADMIN_TABLE,
    placeholderData: keepPreviousData,
  });
}

export function useGateNoShows(organizationId: string | null | undefined, sessionIds: string[]) {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.stats.noShows(organizationId ?? '', sessionIds),
    queryFn: () => getGateNoShows(client, organizationId as string, sessionIds),
    enabled: Boolean(organizationId) && sessionIds.length > 0,
    staleTime: staleTime.ADMIN_TABLE,
  });
}

/**
 * Là mutation chứ không phải query: mỗi lần chạy ghi một dòng nhật ký, nên chỉ chạy khi người dùng
 * bấm nút — không tự chạy lại khi quay về tab, không thử lại ngầm khi lỗi.
 */
export function useExportBuyers(organizationId: string) {
  const client = useApiClient();
  return useMutation({
    mutationFn: (sessionIds: string[]) => exportBuyers(client, organizationId, sessionIds),
    retry: false,
  });
}
