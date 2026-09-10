'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { listMyTickets, listOrderTickets, scanTicket } from '../api/ticketing';
import { queryKeys, staleTime } from '../query/keys';
import { useApiClient } from '../query/provider';
import type { ListMyTicketsParams, ScanRequest, ScanResponse } from '../types/ticketing';

/**
 * Soát một mã QR.
 *
 * Không invalidate gì cả: máy soát vé không giữ danh sách vé nào để làm mới, và ở cửa vào thì
 * mỗi request thừa là thêm một nhịp chờ trên mạng nhà thi đấu.
 *
 * Kết quả từ chối (vé đã soát, sai suất, mã hỏng) về theo `data`, **không** phải `error` —
 * backend luôn trả 200. `error` ở đây chỉ có nghĩa là mạng hỏng hoặc phiên hết hạn.
 */
export function useScanTicket(eventSessionId: string) {
  const client = useApiClient();

  return useMutation<ScanResponse, Error, ScanRequest>({
    mutationFn: (request) => scanTicket(client, eventSessionId, request),
  });
}

const DEFAULT_PAGE = { limit: 50, offset: 0 };

/**
 * Ví vé của chính mình.
 *
 * `qrToken` được backend ký lại mỗi lần gọi, nên đừng cache lâu: mã QR có hạn, và một mã đã hết
 * hạn nằm trong cache là khách đứng ở cửa mà không vào được.
 */
export function useMyTickets(params: ListMyTicketsParams = {}) {
  const client = useApiClient();
  const page = { ...DEFAULT_PAGE, ...params };

  return useQuery({
    queryKey: queryKeys.ticketing.myTickets(page),
    queryFn: () => listMyTickets(client, page),
    staleTime: staleTime.MY_WALLET,
  });
}

export function useOrderTickets(orderId: string | null | undefined) {
  const client = useApiClient();

  return useQuery({
    queryKey: queryKeys.ticketing.orderTickets(orderId ?? ''),
    queryFn: () => listOrderTickets(client, orderId as string),
    enabled: Boolean(orderId),
    staleTime: staleTime.MY_WALLET,
  });
}
