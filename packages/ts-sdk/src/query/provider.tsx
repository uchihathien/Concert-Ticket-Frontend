'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createContext, useContext, useState } from 'react';
import { ApiError } from '../http/api-error';
import type { ApiClient } from '../http/client';

const MAX_RETRIES = 2;

/**
 * Không thử lại lỗi 4xx.
 *
 * `SEAT_UNAVAILABLE` gửi lại y hệt vẫn hỏng — ghế đã của người khác. Chỉ lỗi mạng và 5xx mới
 * đáng thử lại, và `RATE_LIMITED` thì thử lại chính là đổ thêm dầu vào lửa.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false;
  if (error instanceof ApiError) {
    if (error.status === 429) return false;
    return !error.isClientError;
  }
  return true;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        refetchOnWindowFocus: false,
        staleTime: 30_000,
      },
      // Mutation không bao giờ tự thử lại: mọi POST đổi trạng thái đều đi kèm Idempotency-Key
      // sinh theo *ý định* của người dùng, và quyết định thử lại là của người dùng.
      mutations: { retry: false },
    },
  });
}

const ApiClientContext = createContext<ApiClient | null>(null);

export interface NexaQueryProviderProps {
  client: ApiClient;
  children: ReactNode;
  /** Truyền vào ở test hoặc khi app tự quản QueryClient. */
  queryClient?: QueryClient;
}

/** Gắn `ApiClient` và `QueryClient` một lần ở gốc cây, cho cả 4 app. */
export function NexaQueryProvider({ client, children, queryClient }: NexaQueryProviderProps) {
  // useState để mỗi lần render lại không dựng QueryClient mới và xoá sạch cache.
  const [defaultClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient ?? defaultClient}>
      <ApiClientContext.Provider value={client}>{children}</ApiClientContext.Provider>
    </QueryClientProvider>
  );
}

export function useApiClient(): ApiClient {
  const client = useContext(ApiClientContext);
  if (!client) throw new Error('useApiClient phải nằm trong <NexaQueryProvider>');
  return client;
}
