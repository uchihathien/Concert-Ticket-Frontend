'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addKnowledgeChunk,
  askSupport,
  claimHandoff,
  deleteKnowledgeChunk,
  getChatThread,
  getEventRules,
  getHandoffThread,
  listHandoffs,
  listKnowledgeChunks,
  previewKnowledge,
  replyToHandoff,
  requestHumanAgent,
  resolveHandoff,
  saveEventRules,
} from '../api/support';
import { queryKeys, staleTime } from '../query/keys';
import { useApiClient } from '../query/provider';
import type { AskRequest } from '../types/support';

/**
 * Hỏi trợ lý.
 *
 * Làm mới hội thoại sau mỗi lượt: câu trả lời đã nằm trong phản hồi, nhưng lượt ấy cũng có thể
 * vừa MỞ một phiếu chuyển tiếp — và lúc đó cả giao diện phải đổi. Không invalidate thì khách vẫn
 * thấy ô chat như thường trong khi trợ lý đã ngừng trả lời.
 */
export function useAskSupport() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ idempotencyKey, ...request }: AskRequest & { idempotencyKey?: string }) =>
      askSupport(client, request, idempotencyKey),
    onSuccess: (reply) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.support.thread(reply.sessionId) });
    },
  });
}

/**
 * Hội thoại của khách.
 *
 * `refetchInterval` chỉ bật khi có phiếu đang mở — đó là lúc duy nhất câu trả lời đến từ nơi khác
 * mà trình duyệt không biết. Hỏi lại liên tục khi trợ lý AI đang trả lời là hỏi lại một thứ vừa
 * trả về trong chính response của lượt chat.
 */
export function useChatThread(sessionId: string | null | undefined) {
  const client = useApiClient();

  return useQuery({
    queryKey: queryKeys.support.thread(sessionId ?? ''),
    queryFn: () => getChatThread(client, sessionId as string),
    enabled: Boolean(sessionId),
    staleTime: staleTime.SUPPORT_THREAD,
    refetchInterval: (query) => (query.state.data?.handoff ? 5_000 : false),
  });
}

export function useRequestHumanAgent() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => requestHumanAgent(client, sessionId),
    onSuccess: (_handoff, sessionId) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.support.thread(sessionId) });
    },
  });
}

// --- Bàn hỗ trợ ------------------------------------------------------------

/**
 * Hàng đợi của người trực.
 *
 * Hỏi lại mỗi 5 giây. Đây là một danh sách vài chục dòng và người trực đang ngồi nhìn nó — hỏi
 * lại rẻ hơn hẳn việc dựng thêm một kênh đẩy cùng phần dò kết nối lại của nó. Xem ghi chú ở
 * `SupportDeskController`.
 */
export function useHandoffQueue(params: { mine?: boolean } = {}) {
  const client = useApiClient();

  return useQuery({
    queryKey: queryKeys.support.queue(params),
    queryFn: () => listHandoffs(client, params),
    staleTime: staleTime.SUPPORT_THREAD,
    refetchInterval: 5_000,
  });
}

export function useHandoffThread(handoffId: string | null | undefined) {
  const client = useApiClient();

  return useQuery({
    queryKey: queryKeys.support.handoff(handoffId ?? ''),
    queryFn: () => getHandoffThread(client, handoffId as string),
    enabled: Boolean(handoffId),
    staleTime: staleTime.SUPPORT_THREAD,
    // Khách có thể nhắn thêm trong lúc người trực đang gõ. Không hỏi lại thì câu ấy chỉ hiện ra
    // sau khi người trực gửi xong — tức là sau khi họ đã trả lời một câu hỏi cũ.
    refetchInterval: 5_000,
  });
}

export function useClaimHandoff() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (handoffId: string) => claimHandoff(client, handoffId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['support'] });
    },
  });
}

export function useReplyToHandoff(handoffId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (text: string) => replyToHandoff(client, handoffId, text),
    // Phản hồi ĐÃ là cả hội thoại sau khi ghi — đặt thẳng vào cache thay vì hỏi lại. Tiết kiệm
    // một vòng khứ hồi ở đúng chỗ người trực đang gõ liên tục.
    onSuccess: (thread) => {
      queryClient.setQueryData(queryKeys.support.handoff(handoffId), thread);
    },
  });
}

export function useResolveHandoff() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (handoffId: string) => resolveHandoff(client, handoffId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['support'] });
    },
  });
}

// --- Kho tri thức của trợ lý ------------------------------------------------

export function useKnowledgeChunks(
  params: { eventId?: string; page?: number; size?: number } = {},
) {
  const client = useApiClient();

  return useQuery({
    queryKey: queryKeys.support.knowledge(params),
    queryFn: () => listKnowledgeChunks(client, params),
    staleTime: staleTime.SUPPORT_THREAD,
  });
}

export function useAddKnowledgeChunk() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: { eventId?: string | null; title: string; content: string }) =>
      addKnowledgeChunk(client, body),
    // Làm mới CẢ nhánh knowledge: một đoạn mới đổi cả danh mục lẫn kết quả của mọi câu hỏi thử
    // đang hiện trên màn hình — và câu hỏi thử là thứ người soạn nhìn để biết mình vừa làm gì.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['support', 'knowledge'] });
    },
  });
}

export function useDeleteKnowledgeChunk() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteKnowledgeChunk(client, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['support', 'knowledge'] });
    },
  });
}

/**
 * Thử một câu hỏi.
 *
 * `enabled` theo câu hỏi chứ không chạy khi rỗng: mỗi lần thử là một lần nhúng, và nhúng một chuỗi
 * rỗng vừa tốn vừa trả về thứ không đọc được.
 */
export function useKnowledgePreview(question: string) {
  const client = useApiClient();

  return useQuery({
    queryKey: queryKeys.support.knowledgePreview(question),
    queryFn: () => previewKnowledge(client, question),
    enabled: question.trim().length > 0,
    staleTime: staleTime.SUPPORT_THREAD,
  });
}

export function useEventRules(eventId: string | null | undefined) {
  const client = useApiClient();

  return useQuery({
    queryKey: queryKeys.support.eventRules(eventId ?? ''),
    queryFn: () => getEventRules(client, eventId as string),
    enabled: Boolean(eventId),
    staleTime: staleTime.SUPPORT_THREAD,
  });
}

export function useSaveEventRules(eventId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: { eventTitle: string; content: string; published: boolean }) =>
      saveEventRules(client, eventId, body),
    onSuccess: (rules) => {
      queryClient.setQueryData(queryKeys.support.eventRules(eventId), rules);
    },
  });
}
