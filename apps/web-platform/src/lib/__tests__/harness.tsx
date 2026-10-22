import { createApiClient, NexaQueryProvider } from '@nexaticket/ts-sdk';
import { ToastProvider } from '@nexaticket/ui';
import { QueryClient } from '@tanstack/react-query';
import { render, renderHook } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { vi } from 'vitest';

/**
 * Khung render cho component/hook của app nền tảng.
 *
 * Giống apps/web-customer/src/components/__tests__/harness.tsx: `fetch` giả truyền thẳng vào
 * ApiClient thật (MSW không dùng được trong jsdom vì fetch của undici từ chối AbortSignal của
 * jsdom). Toàn bộ đường đi hook → ApiClient → dựng request được giữ nguyên; chỉ thay lớp mạng.
 */
export interface FakeCall {
  method: string;
  /** Đường dẫn kèm query string. */
  path: string;
  body: unknown;
}

export type FakeRoute = (call: FakeCall) => {
  status: number;
  body?: unknown;
};

function createHarness(route: FakeRoute) {
  const calls: FakeCall[] = [];
  const fakeFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const call: FakeCall = {
      method: init?.method ?? 'GET',
      path: url.pathname + url.search,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    const { status, body } = route(call);
    return new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  });
  const api = createApiClient({
    baseUrl: 'http://gateway.test',
    fetch: fakeFetch as unknown as typeof fetch,
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <NexaQueryProvider client={api} queryClient={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </NexaQueryProvider>
  );
  return { calls, queryClient, Wrapper };
}

export function renderWithApi(ui: ReactElement, route: FakeRoute) {
  const { calls, queryClient, Wrapper } = createHarness(route);
  const utils = render(ui, { wrapper: Wrapper });
  return { ...utils, calls, queryClient };
}

export function renderHookWithApi<T>(hook: () => T, route: FakeRoute) {
  const { calls, queryClient, Wrapper } = createHarness(route);
  const utils = renderHook(hook, { wrapper: Wrapper });
  return { ...utils, calls, queryClient };
}

/** Quyền của người đang đăng nhập, đúng dạng `GET /v1/me/permissions`. */
export function permissionsBody(options: {
  superAdmin?: boolean;
  platformPermissions?: string[];
  organizations?: Record<string, string[]>;
}) {
  return {
    userId: 'u1',
    superAdmin: options.superAdmin ?? false,
    platformPermissions: options.platformPermissions ?? [],
    organizations: options.organizations ?? {},
  };
}
