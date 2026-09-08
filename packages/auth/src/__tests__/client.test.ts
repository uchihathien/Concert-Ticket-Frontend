import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAccessToken, getAccessToken, onSessionExpired, TOKEN_ENDPOINT } from '../client';

function tokenResponse(accessToken: string, ttlMs: number): Response {
  return new Response(JSON.stringify({ accessToken, expiresAt: Date.now() + ttlMs }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('access token phía client', () => {
  beforeEach(() => {
    clearAccessToken();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lấy token qua /api/auth/token và giữ lại trong memory', async () => {
    const fetchImpl = vi.fn(async (..._args: unknown[]) => tokenResponse('at-1', 300_000));
    vi.stubGlobal('fetch', fetchImpl);

    expect(await getAccessToken()).toBe('at-1');
    expect(await getAccessToken()).toBe('at-1');

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(TOKEN_ENDPOINT);
  });

  it('không bao giờ ghi vào localStorage hay sessionStorage', async () => {
    vi.stubGlobal('fetch', async () => tokenResponse('at-1', 300_000));
    const localSpy = vi.spyOn(Storage.prototype, 'setItem');

    await getAccessToken();

    expect(localSpy).not.toHaveBeenCalled();
    // Đọc thẳng storage ở đây là cố ý: bài test tồn tại để chứng minh nó rỗng.
    // eslint-disable-next-line no-restricted-properties
    expect(window.localStorage.length).toBe(0);
    expect(globalThis.sessionStorage.length).toBe(0);
  });

  it('nhiều nơi cùng hỏi lúc khởi động chỉ tốn một request', async () => {
    const fetchImpl = vi.fn(async (..._args: unknown[]) => tokenResponse('at-1', 300_000));
    vi.stubGlobal('fetch', fetchImpl);

    const [a, b, c] = await Promise.all([getAccessToken(), getAccessToken(), getAccessToken()]);

    expect([a, b, c]).toEqual(['at-1', 'at-1', 'at-1']);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('token sắp hết hạn thì hỏi lại, không dùng bản cũ', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse('at-1', 10_000))
      .mockResolvedValueOnce(tokenResponse('at-2', 300_000));
    vi.stubGlobal('fetch', fetchImpl);

    expect(await getAccessToken()).toBe('at-1');
    // 10 giây còn lại nằm trong biên an toàn 30 giây.
    expect(await getAccessToken()).toBe('at-2');
  });

  it('401 thì xoá token và báo phiên hết hạn', async () => {
    vi.stubGlobal('fetch', async () => new Response(null, { status: 401 }));
    const listener = vi.fn();
    const off = onSessionExpired(listener);

    expect(await getAccessToken()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);

    off();
  });

  it('mất mạng thì giữ token đang có thay vì đá người dùng ra', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse('at-1', 10_000))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchImpl);

    expect(await getAccessToken()).toBe('at-1');
    expect(await getAccessToken()).toBe('at-1');
  });
});
