'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cancelOrder, getOrder, listMyOrders } from '../api/ordering';
import { queryKeys, staleTime } from '../query/keys';
import { useApiClient } from '../query/provider';
import type { ListMyOrdersParams, Order } from '../types/ordering';

const DEFAULT_PAGE = { limit: 20, offset: 0 };

export function useMyOrders(params: ListMyOrdersParams = {}) {
  const client = useApiClient();
  const page = { ...DEFAULT_PAGE, ...params };

  return useQuery({
    queryKey: queryKeys.ordering.myOrders(page),
    queryFn: () => listMyOrders(client, page),
    staleTime: staleTime.MY_WALLET,
  });
}

export function useOrder(orderId: string | null | undefined) {
  const client = useApiClient();

  return useQuery({
    queryKey: queryKeys.ordering.order(orderId ?? ''),
    queryFn: () => getOrder(client, orderId as string),
    enabled: Boolean(orderId),
    staleTime: staleTime.MY_WALLET,
  });
}

/**
 * Huỷ đơn chưa thanh toán.
 *
 * Làm mới cả danh sách lẫn đơn lẻ: khách huỷ từ trong trang chi tiết rồi quay ra danh sách, thấy
 * đơn vẫn "chờ thanh toán" thì sẽ bấm huỷ lần nữa.
 *
 * `retry: false` như mọi mutation (plan/frontend.md §5) — thử lại một lệnh ghi mà không có
 * `Idempotency-Key` là cách tạo ra hành động trùng.
 */
export function useCancelOrder() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (orderId) => cancelOrder(client, orderId),
    retry: false,
    onSuccess: (_data, orderId) => {
      queryClient.invalidateQueries({ queryKey: ['ordering', 'me', 'orders'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.ordering.order(orderId) });
    },
  });
}

export type { Order };
