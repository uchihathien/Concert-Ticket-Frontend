'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createEvent,
  createSession,
  createTicketType,
  createVenue,
  createZone,
  deleteSession,
  deleteTicketType,
  getEvent,
  listEvents,
  listVenues,
  publishEvent,
  unpublishEvent,
  updateEvent,
  updateSession,
  updateTicketType,
} from '../api/catalog';
import { ApiError } from '../http/api-error';
import { queryKeys, staleTime } from '../query/keys';
import { useApiClient } from '../query/provider';
import type {
  AdminEventDetail,
  CreateEventRequest,
  CreateSessionRequest,
  CreateTicketTypeRequest,
  CreateVenueRequest,
  CreateZoneRequest,
  UpdateEventRequest,
  UpdateSessionRequest,
  UpdateTicketTypeRequest,
} from '../types/catalog';

export function useVenues(organizationId: string | null | undefined) {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.catalog.venues(organizationId ?? ''),
    queryFn: () => listVenues(client, organizationId as string),
    enabled: Boolean(organizationId),
    staleTime: staleTime.ADMIN_TABLE,
  });
}

export function useAdminEvents(organizationId: string | null | undefined) {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.catalog.events(organizationId ?? ''),
    queryFn: () => listEvents(client, organizationId as string),
    enabled: Boolean(organizationId),
    staleTime: staleTime.ADMIN_TABLE,
  });
}

export function useAdminEvent(
  organizationId: string | null | undefined,
  eventId: string | null | undefined,
) {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.catalog.event(organizationId ?? '', eventId ?? ''),
    queryFn: () => getEvent(client, organizationId as string, eventId as string),
    enabled: Boolean(organizationId && eventId),
    staleTime: staleTime.ADMIN_TABLE,
  });
}

export function useCreateVenue(organizationId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateVenueRequest & { idempotencyKey?: string }) => {
      const { idempotencyKey, ...request } = input;
      return createVenue(client, organizationId, request, idempotencyKey);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.venues(organizationId) });
    },
  });
}

export function useCreateZone(organizationId: string, venueId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateZoneRequest & { idempotencyKey?: string }) => {
      const { idempotencyKey, ...request } = input;
      return createZone(client, organizationId, venueId, request, idempotencyKey);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.venues(organizationId) });
    },
  });
}

export function useCreateEvent(organizationId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateEventRequest & { idempotencyKey?: string }) => {
      const { idempotencyKey, ...request } = input;
      return createEvent(client, organizationId, request, idempotencyKey);
    },
    onSuccess: (event) => syncEvent(queryClient, organizationId, event),
  });
}

export function useUpdateEvent(organizationId: string, eventId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: UpdateEventRequest) =>
      updateEvent(client, organizationId, eventId, request),
    onSuccess: (event) => syncEvent(queryClient, organizationId, event),
  });
}

export function useCreateSession(organizationId: string, eventId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateSessionRequest & { idempotencyKey?: string }) => {
      const { idempotencyKey, ...request } = input;
      return createSession(client, organizationId, eventId, request, idempotencyKey);
    },
    onSuccess: (event) => syncEvent(queryClient, organizationId, event),
  });
}

export function useCreateTicketType(organizationId: string, eventId: string, sessionId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTicketTypeRequest & { idempotencyKey?: string }) => {
      const { idempotencyKey, ...request } = input;
      return createTicketType(client, organizationId, eventId, sessionId, request, idempotencyKey);
    },
    onSuccess: (event) => syncEvent(queryClient, organizationId, event),
  });
}

/**
 * Sửa và xoá nhận suất diễn qua biến của lệnh, không qua tham số của hook.
 *
 * Khác với `useCreateSession`/`useCreateTicketType` — hai cái đó sống trong hộp thoại chỉ dựng lên
 * khi đã biết đang thêm vào đâu. Còn nút sửa/xoá nằm rải trên mọi dòng của mọi suất diễn: buộc
 * hook nhận `sessionId` sẽ cần một hook cho mỗi dòng, mà hook thì không gọi trong vòng lặp được.
 */
export function useUpdateSession(organizationId: string, eventId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, ...request }: UpdateSessionRequest & { sessionId: string }) =>
      updateSession(client, organizationId, eventId, sessionId, request),
    onSuccess: (event) => syncEvent(queryClient, organizationId, event),
  });
}

export function useDeleteSession(organizationId: string, eventId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId }: { sessionId: string }) =>
      deleteSession(client, organizationId, eventId, sessionId),
    onSuccess: (event) => syncEvent(queryClient, organizationId, event),
  });
}

export function useUpdateTicketType(organizationId: string, eventId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sessionId,
      ticketTypeId,
      ...request
    }: UpdateTicketTypeRequest & { sessionId: string; ticketTypeId: string }) =>
      updateTicketType(client, organizationId, eventId, sessionId, ticketTypeId, request),
    onSuccess: (event) => syncEvent(queryClient, organizationId, event),
  });
}

export function useDeleteTicketType(organizationId: string, eventId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, ticketTypeId }: { sessionId: string; ticketTypeId: string }) =>
      deleteTicketType(client, organizationId, eventId, sessionId, ticketTypeId),
    onSuccess: (event) => syncEvent(queryClient, organizationId, event),
  });
}

export function usePublishEvent(organizationId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ eventId, publish }: { eventId: string; publish: boolean }) =>
      publish
        ? publishEvent(client, organizationId, eventId)
        : unpublishEvent(client, organizationId, eventId),
    onSuccess: (event) => syncEvent(queryClient, organizationId, event),
  });
}

/**
 * Khai giá cho NHIỀU khu trong một thao tác.
 *
 * <h3>Vì sao cần</h3>
 *
 * Một nhà thi đấu có 91 khu. Đường một-khu-một-lần nghĩa là mở hộp thoại 91 lần, và bảng hạng vé
 * thành 91 dòng phải sửa từng dòng. Đó không phải sự bất tiện — đó là lý do một sân như vậy không
 * dựng nổi bằng giao diện.
 *
 * <h3>Vì sao gọi tuần tự chứ không bắn song song</h3>
 *
 * Mỗi lời gọi là một transaction ở catalog và trả về TOÀN BỘ chi tiết sự kiện. Bắn 91 request song
 * song là 91 bản chi tiết cùng lúc trên đường mạng, và những bản về sau mang trạng thái cũ hơn
 * những bản về trước — ghi bừa vào cache thì bảng nhảy ngược. Tuần tự thì bản cuối cùng là bản mới
 * nhất, và đó là bản duy nhất được ghi vào cache.
 *
 * <h3>Hỏng một khu không được huỷ cả lô</h3>
 *
 * Endpoint không có giao dịch chung, nên "tất cả hoặc không gì" là lời hứa không giữ được. Thay vì
 * giả vờ, hàm này đi hết danh sách và trả về những khu hỏng kèm lý do — người dùng thấy "đã khai 88
 * khu, 3 khu lỗi" và biết phải làm gì tiếp, thay vì một thông báo lỗi che mất 88 việc đã xong.
 */
export function useBulkTicketTypes(organizationId: string, eventId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      sessionId: string;
      lines: CreateTicketTypeRequest[];
      onProgress?: (done: number, total: number) => void;
    }) => {
      let event: AdminEventDetail | null = null;
      const failed: Array<{ venueZoneId: string; message: string }> = [];

      for (const [index, line] of input.lines.entries()) {
        try {
          event = await createTicketType(client, organizationId, eventId, input.sessionId, line);
        } catch (error) {
          failed.push({
            venueZoneId: line.venueZoneId,
            // `code` chứ không phải `detail`: detail là tiếng Anh dành cho log và có thể rỗng,
            // còn code là thứ giao diện dịch được sang câu cho người dùng.
            message: error instanceof ApiError ? error.code : String(error),
          });
        }
        input.onProgress?.(index + 1, input.lines.length);
      }

      return { event, failed };
    },
    onSuccess: ({ event }) => {
      if (event) syncEvent(queryClient, organizationId, event);
    },
  });
}

/**
 * Mọi lệnh ghi của catalog đều trả về chi tiết sự kiện sau khi đổi.
 *
 * Ghi thẳng vào cache thay vì chỉ invalidate: màn hình cập nhật ngay trong cùng một nhịp, không
 * nhấp nháy qua trạng thái loading cho một dữ liệu mà server vừa đưa đủ. Bảng danh sách thì vẫn
 * phải hỏi lại vì nó có các cột tổng hợp không nằm trong response này.
 */
function syncEvent(
  queryClient: ReturnType<typeof useQueryClient>,
  organizationId: string,
  event: AdminEventDetail,
): void {
  queryClient.setQueryData(queryKeys.catalog.event(organizationId, event.id), event);
  void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.events(organizationId) });
}
