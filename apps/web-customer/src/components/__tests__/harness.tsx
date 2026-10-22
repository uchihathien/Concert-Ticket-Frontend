import { createApiClient, NexaQueryProvider } from '@nexaticket/ts-sdk';
import { ToastProvider } from '@nexaticket/ui';
import { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';

/**
 * Khung render cho component client của app khách.
 *
 * `fetch` giả truyền thẳng vào ApiClient (thay vì MSW): component cần jsdom để render, mà fetch
 * của undici từ chối AbortSignal của jsdom. Cách này giữ nguyên toàn bộ đường đi thật từ hook →
 * ApiClient → dựng request, chỉ thay mỗi lớp mạng.
 */
export interface FakeCall {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
}

export type FakeRoute = (call: FakeCall) => {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
};

export function renderWithApi(ui: ReactElement, route: FakeRoute) {
  const calls: FakeCall[] = [];
  const fakeFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const call: FakeCall = {
      method: init?.method ?? 'GET',
      path: url.pathname + url.search,
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    const { status, body, headers } = route(call);
    return new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json', ...headers },
    });
  });

  const api = createApiClient({
    baseUrl: 'http://gateway.test',
    fetch: fakeFetch as unknown as typeof fetch,
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const utils = render(
    <NexaQueryProvider client={api} queryClient={queryClient}>
      <ToastProvider>{ui}</ToastProvider>
    </NexaQueryProvider>,
  );
  return { ...utils, calls, queryClient };
}
