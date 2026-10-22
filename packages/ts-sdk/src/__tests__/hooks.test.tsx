// Hook react-query: đúng query key, đúng điều kiện `enabled`, và mutation làm mới đúng mục cache.
//
// Không dùng MSW ở đây: hook cần jsdom để render, mà fetch của undici từ chối AbortSignal của jsdom
// (xem client.test.ts). Thay vào đó truyền một `fetch` giả thẳng vào ApiClient — client cho phép
// đúng việc này qua `ApiClientOptions.fetch`.
import { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useBulkTicketTypes, usePublishEvent } from '../hooks/catalog';
import { useAcceptInvitation, useChangeMemberRole, useCreateOrganization } from '../hooks/identity';
import { usePlaceHold, useReleaseHold, useSeatMap } from '../hooks/inventory';
import { useCancelOrder, useMyOrders, useOrder } from '../hooks/ordering';
import { useClaimHandoff, useKnowledgePreview } from '../hooks/support';
import { useMyTickets, useOrderTickets } from '../hooks/ticketing';
import { createApiClient } from '../http/client';
import { queryKeys } from '../query/keys';
import { NexaQueryProvider, useApiClient } from '../query/provider';

interface Call {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

type Route = (call: Call) => { status: number; body?: unknown; headers?: Record<string, string> };

function setup(route: Route) {
  const calls: Call[] = [];
  const fakeFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const call: Call = {
      method: init?.method ?? 'GET',
      url: url.pathname + url.search,
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
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <NexaQueryProvider client={api} queryClient={queryClient}>
      {children}
    </NexaQueryProvider>
  );
  const invalidatedKeys = () => invalidate.mock.calls.map(([filters]) => filters?.queryKey);
  return { calls, queryClient, wrapper, invalidatedKeys };
}

const ok: Route = () => ({ status: 200, body: [] });

describe('useApiClient', () => {
  it('ném lỗi rõ ràng khi quên bọc NexaQueryProvider', () => {
    // React in lỗi ra console khi hook ném trong render — tắt cho gọn log.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useApiClient())).toThrow(/NexaQueryProvider/);
  });
});

describe('ordering hooks', () => {
  it('useMyOrders: trang mặc định 20/0 nằm trong cả key lẫn URL', async () => {
    const { calls, queryClient, wrapper } = setup(ok);
    const { result } = renderHook(() => useMyOrders(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(calls.map((c) => c.url)).toEqual(['/v1/me/orders?limit=20&offset=0']);
    expect(
      queryClient.getQueryData(queryKeys.ordering.myOrders({ limit: 20, offset: 0 })),
    ).toEqual([]);
  });

  it('useOrder không gọi mạng khi chưa có orderId', async () => {
    const { calls, wrapper } = setup(ok);
    const { result } = renderHook(() => useOrder(null), { wrapper });
    // Cho react-query một nhịp để (không) gửi request.
    await act(async () => {});
    expect(result.current.fetchStatus).toBe('idle');
    expect(calls).toHaveLength(0);
  });

  it('useCancelOrder làm mới MỌI trang danh sách đơn và chính đơn đó', async () => {
    const { calls, wrapper, invalidatedKeys } = setup(() => ({ status: 204 }));
    const { result } = renderHook(() => useCancelOrder(), { wrapper });

    await act(() => result.current.mutateAsync('o1'));

    expect(calls[0]).toMatchObject({ method: 'POST', url: '/v1/orders/o1/cancel' });
    // Tiền tố không kèm tham số trang: đơn vừa huỷ có thể nằm ở bất kỳ trang nào đang cache.
    expect(invalidatedKeys()).toEqual([
      ['ordering', 'me', 'orders'],
      queryKeys.ordering.order('o1'),
    ]);
  });

  it('useCancelOrder không thử lại và không invalidate khi backend từ chối', async () => {
    const { calls, wrapper, invalidatedKeys } = setup(() => ({
      status: 409,
      body: { code: 'ORDER_NOT_CANCELLABLE' },
    }));
    const { result } = renderHook(() => useCancelOrder(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('o1').catch(() => undefined);
    });

    expect(calls).toHaveLength(1);
    expect(invalidatedKeys()).toEqual([]);
    expect(result.current.error).toMatchObject({ code: 'ORDER_NOT_CANCELLABLE' });
  });
});

describe('inventory hooks', () => {
  const seatMap = { eventSessionId: 's1', availabilityVersion: 1, seats: [], standingZones: [] };

  it('useSeatMap lần refetch gửi If-None-Match từ snapshot đang cache, 304 giữ dữ liệu cũ', async () => {
    let n = 0;
    const { calls, wrapper } = setup(() => {
      n += 1;
      return n === 1
        ? { status: 200, body: seatMap, headers: { ETag: '"v1"' } }
        : { status: 304, headers: { ETag: '"v1"' } };
    });
    const { result } = renderHook(() => useSeatMap('s1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    await act(async () => {
      await result.current.refetch();
    });

    expect(calls.map((c) => c.headers['If-None-Match'])).toEqual([undefined, '"v1"']);
    expect(result.current.data?.data).toEqual(seatMap);
  });

  it('useSeatMap tắt khi enabled=false', async () => {
    const { calls, wrapper } = setup(ok);
    renderHook(() => useSeatMap('s1', { enabled: false }), { wrapper });
    await act(async () => {});
    expect(calls).toHaveLength(0);
  });

  it('usePlaceHold gửi Idempotency-Key KHÔNG lọt vào body, rồi làm mới sơ đồ của đúng suất', async () => {
    const { calls, wrapper, invalidatedKeys } = setup(() => ({
      status: 201,
      body: { holdId: 'h1', expiresAt: 'x', seatIds: ['a'], availabilityVersion: 2 },
    }));
    const { result } = renderHook(() => usePlaceHold('s1'), { wrapper });

    await act(() => result.current.mutateAsync({ seatIds: ['a'], idempotencyKey: 'k1' }));

    expect(calls[0]!.headers['Idempotency-Key']).toBe('k1');
    expect(calls[0]!.body).toEqual({ seatIds: ['a'], seatedZones: [], standing: [] });
    expect(invalidatedKeys()).toEqual([queryKeys.inventory.seatMap('s1')]);
  });

  it('useReleaseHold làm mới sơ đồ sau khi nhả chỗ', async () => {
    const { calls, wrapper, invalidatedKeys } = setup(() => ({ status: 204 }));
    const { result } = renderHook(() => useReleaseHold('s1'), { wrapper });
    await act(() => result.current.mutateAsync('h1'));
    expect(calls[0]).toMatchObject({ method: 'DELETE', url: '/v1/holds/h1' });
    expect(invalidatedKeys()).toEqual([queryKeys.inventory.seatMap('s1')]);
  });
});

describe('ticketing hooks', () => {
  it('useMyTickets mặc định 50/0; useOrderTickets chờ có orderId', async () => {
    const { calls, wrapper } = setup(ok);
    const tickets = renderHook(() => useMyTickets(), { wrapper });
    renderHook(() => useOrderTickets(undefined), { wrapper });
    await waitFor(() => expect(tickets.result.current.isSuccess).toBe(true));
    expect(calls.map((c) => c.url)).toEqual(['/v1/me/tickets?limit=50&offset=0']);
  });
});

describe('identity hooks', () => {
  it('useAcceptInvitation làm mới danh sách tổ chức của tôi và tổ chức vừa vào', async () => {
    const { wrapper, invalidatedKeys } = setup(() => ({ status: 200, body: { id: 'org9' } }));
    const { result } = renderHook(() => useAcceptInvitation(), { wrapper });
    await act(() => result.current.mutateAsync('tok'));
    expect(invalidatedKeys()).toEqual([
      queryKeys.identity.myOrganizations(),
      queryKeys.identity.organization('org9'),
    ]);
  });

  it('useChangeMemberRole làm mới danh sách thành viên VÀ quyền của chính mình', async () => {
    const { wrapper, invalidatedKeys } = setup(ok);
    const { result } = renderHook(() => useChangeMemberRole('org1'), { wrapper });
    await act(() => result.current.mutateAsync({ userId: 'u1', role: 'ADMIN' as never }));
    expect(invalidatedKeys()).toEqual(
      expect.arrayContaining([
        queryKeys.identity.members('org1'),
        queryKeys.identity.myPermissions(),
      ]),
    );
  });

  it('useCreateOrganization tách idempotencyKey ra header và làm mới danh sách nền tảng', async () => {
    const { calls, wrapper, invalidatedKeys } = setup(() => ({ status: 201, body: { id: 'o' } }));
    const { result } = renderHook(() => useCreateOrganization(), { wrapper });
    await act(() =>
      result.current.mutateAsync({ name: 'BTC', idempotencyKey: 'k-org' } as never),
    );
    expect(calls[0]!.headers['Idempotency-Key']).toBe('k-org');
    expect(calls[0]!.body).not.toHaveProperty('idempotencyKey');
    expect(invalidatedKeys()).toContainEqual(['identity', 'platform', 'organizations']);
  });
});

describe('catalog hooks', () => {
  it('usePublishEvent ghi thẳng sự kiện vào cache chi tiết và làm mới danh sách', async () => {
    const event = { id: 'e1', status: 'PUBLISHED' };
    const { calls, queryClient, wrapper, invalidatedKeys } = setup(() => ({
      status: 200,
      body: event,
    }));
    const { result } = renderHook(() => usePublishEvent('org1'), { wrapper });

    await act(() => result.current.mutateAsync({ eventId: 'e1', publish: false }));

    expect(calls[0]!.url).toBe('/v1/organizations/org1/events/e1/unpublish');
    expect(queryClient.getQueryData(queryKeys.catalog.event('org1', 'e1'))).toEqual(event);
    expect(invalidatedKeys()).toEqual([queryKeys.catalog.events('org1')]);
  });

  it('useBulkTicketTypes: một dòng hỏng không chặn các dòng sau, lỗi mang `code` chứ không phải detail', async () => {
    const { calls, wrapper } = setup((call) =>
      (call.body as { venueZoneId: string }).venueZoneId === 'z2'
        ? { status: 409, body: { code: 'TICKET_TYPE_EXISTS', detail: 'dup' } }
        : { status: 201, body: { id: 'e1' } },
    );
    const progress = vi.fn();
    const { result } = renderHook(() => useBulkTicketTypes('org1', 'e1'), { wrapper });

    let outcome: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined;
    await act(async () => {
      outcome = await result.current.mutateAsync({
        sessionId: 's1',
        lines: [{ venueZoneId: 'z1' }, { venueZoneId: 'z2' }, { venueZoneId: 'z3' }] as never,
        onProgress: progress,
      });
    });

    expect(calls).toHaveLength(3);
    expect(outcome?.failed).toEqual([{ venueZoneId: 'z2', message: 'TICKET_TYPE_EXISTS' }]);
    expect(progress.mock.calls).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });
});

describe('support hooks', () => {
  it('useKnowledgePreview không gọi mạng với câu hỏi chỉ có khoảng trắng', async () => {
    const { calls, wrapper } = setup(ok);
    renderHook(() => useKnowledgePreview('   '), { wrapper });
    await act(async () => {});
    expect(calls).toHaveLength(0);
  });

  it('useClaimHandoff ghi luồng vào cache của phiếu và làm mới cả nhánh support', async () => {
    const thread = { handoff: { id: 'h1' }, messages: [] };
    const { queryClient, wrapper, invalidatedKeys } = setup(() => ({ status: 200, body: thread }));
    const { result } = renderHook(() => useClaimHandoff(), { wrapper });
    await act(() => result.current.mutateAsync('h1'));
    expect(queryClient.getQueryData(queryKeys.support.handoff('h1'))).toEqual(thread);
    expect(invalidatedKeys()).toEqual([['support']]);
  });
});
