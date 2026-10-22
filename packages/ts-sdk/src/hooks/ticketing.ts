'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createCheckinGate,
  createShift,
  deleteCheckinGate,
  deleteShift,
  listCheckinGates,
  listEventShifts,
  listMyTickets,
  listOrderTickets,
  renameCheckinGate,
  scanTicket,
  updateShift,
} from '../api/ticketing';
import { queryKeys, staleTime } from '../query/keys';
import { useApiClient } from '../query/provider';
import type { CheckinShiftRequest, ListMyTicketsParams, ScanRequest, ScanResponse } from '../types/ticketing';

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

/* ---------------------------------------------------------------------------
 * Ca trực (ban tổ chức)
 * ------------------------------------------------------------------------- */

export function useCheckinGates(organizationId: string | null | undefined, eventId: string | null | undefined) {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.ticketing.gates(organizationId ?? '', eventId ?? ''),
    queryFn: () => listCheckinGates(client, organizationId as string, eventId as string),
    enabled: Boolean(organizationId && eventId),
    staleTime: staleTime.ADMIN_TABLE,
  });
}

/**
 * Ca của một sự kiện, kèm ai đang trực. Tự làm mới mỗi 20 giây: đây là bảng theo dõi cổng trong
 * lúc mở cửa, người xem không bấm tải lại.
 */
export function useEventShifts(organizationId: string | null | undefined, eventId: string | null | undefined) {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.ticketing.shifts(organizationId ?? '', eventId ?? ''),
    queryFn: () => listEventShifts(client, organizationId as string, eventId as string),
    enabled: Boolean(organizationId && eventId),
    refetchInterval: 20_000,
  });
}

/** Mọi thao tác ca / cổng làm mới cả hai bảng của sự kiện đó. */
function useShiftMutation<TInput, TResult>(
  organizationId: string,
  eventId: string,
  mutationFn: (client: ReturnType<typeof useApiClient>, input: TInput) => Promise<TResult>,
) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TInput) => mutationFn(client, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.ticketing.gates(organizationId, eventId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.ticketing.shifts(organizationId, eventId) });
    },
  });
}

export function useCreateCheckinGate(organizationId: string, eventId: string) {
  return useShiftMutation(organizationId, eventId, (client, name: string) =>
    createCheckinGate(client, organizationId, eventId, name),
  );
}

export function useRenameCheckinGate(organizationId: string, eventId: string) {
  return useShiftMutation(organizationId, eventId, (client, input: { gateId: string; name: string }) =>
    renameCheckinGate(client, organizationId, input.gateId, input.name),
  );
}

export function useDeleteCheckinGate(organizationId: string, eventId: string) {
  return useShiftMutation(organizationId, eventId, (client, gateId: string) =>
    deleteCheckinGate(client, organizationId, gateId),
  );
}

export function useSaveShift(organizationId: string, eventId: string) {
  return useShiftMutation(
    organizationId,
    eventId,
    (client, input: { shiftId?: string; request: CheckinShiftRequest }) =>
      input.shiftId
        ? updateShift(client, organizationId, input.shiftId, input.request)
        : createShift(client, organizationId, input.request),
  );
}

export function useDeleteShift(organizationId: string, eventId: string) {
  return useShiftMutation(organizationId, eventId, (client, shiftId: string) =>
    deleteShift(client, organizationId, shiftId),
  );
}
