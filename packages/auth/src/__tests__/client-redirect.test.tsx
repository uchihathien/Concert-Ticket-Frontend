import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAccessToken,
  createSignInRedirect,
  getAccessToken,
  markSessionExpired,
  onSessionExpired,
  useSessionState,
} from '../client';
import { safeReturnUrl } from '../return-url';

function tokenResponse(accessToken: string, ttlMs: number): Response {
  return new Response(JSON.stringify({ accessToken, expiresAt: Date.now() + ttlMs }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** jsdom không cho gán `window.location.assign` trực tiếp — thay cả `location` trong một test. */
function stubLocation(pathname: string, search = '') {
  const assign = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { pathname, search, assign },
  });
  return assign;
}

describe('createSignInRedirect — đường thoát khi gateway trả 401', () => {
  const realLocation = window.location;

  beforeEach(() => clearAccessToken());
  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
  });

  it('xoá token trong bộ nhớ, báo phiên hết hạn và đưa về /login kèm returnUrl đã mã hoá', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => tokenResponse('at-1', 300_000)));
    await getAccessToken();
    const assign = stubLocation('/me/orders', '?page=2&q=a b');
    const expired = vi.fn();
    const unsubscribe = onSessionExpired(expired);

    createSignInRedirect()();

    expect(expired).toHaveBeenCalledOnce();
    expect(assign).toHaveBeenCalledWith(
      `/login?returnUrl=${encodeURIComponent('/me/orders?page=2&q=a b')}`,
    );
    // Token cũ không được dùng lại: lần hỏi sau phải đi mạng.
    const fetchAgain = vi.fn(async () => tokenResponse('at-2', 300_000));
    vi.stubGlobal('fetch', fetchAgain);
    expect(await getAccessToken()).toBe('at-2');
    expect(fetchAgain).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it('năm lời gọi song song cùng 401 chỉ tạo MỘT lệnh điều hướng', () => {
    const assign = stubLocation('/me/tickets');
    const redirect = createSignInRedirect();
    for (let i = 0; i < 5; i++) redirect();
    expect(assign).toHaveBeenCalledTimes(1);
  });

  it('đang ở trang đăng nhập thì không chuyển hướng — tránh vòng lặp tải lại', () => {
    const assign = stubLocation('/login', '?returnUrl=%2Fme');
    createSignInRedirect('/login')();
    expect(assign).not.toHaveBeenCalled();
  });

  it('returnUrl do redirect tạo ra đi qua được safeReturnUrl nguyên vẹn', () => {
    const assign = stubLocation('/orders/o-1/pay', '?from=email');
    createSignInRedirect()();
    const target = new URL(assign.mock.calls[0]![0] as string, 'http://app.test');
    expect(safeReturnUrl(target.searchParams.get('returnUrl'))).toBe('/orders/o-1/pay?from=email');
  });
});

describe('useSessionState', () => {
  beforeEach(() => clearAccessToken());
  afterEach(() => vi.unstubAllGlobals());

  it('có token thì authenticated; phiên bị đánh dấu hết hạn thì chuyển sang anonymous', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => tokenResponse('at-1', 300_000)));
    const { result } = renderHook(() => useSessionState());
    expect(result.current.state).toBe('unknown');
    await waitFor(() => expect(result.current.state).toBe('authenticated'));

    act(() => markSessionExpired());
    expect(result.current.state).toBe('anonymous');
  });

  it('/api/auth/token trả 401 thì anonymous', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 401 })));
    const { result } = renderHook(() => useSessionState());
    await waitFor(() => expect(result.current.state).toBe('anonymous'));
  });

  it('Keycloak trục trặc (503) KHÔNG đăng xuất người đang có token', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse('at-1', 10_000))
      .mockResolvedValueOnce(new Response('', { status: 503 }));
    vi.stubGlobal('fetch', fetchImpl);
    // Token đầu sống 10s < biên 30s nên lần hỏi thứ hai phải đi mạng và nhận 503.
    await getAccessToken();
    expect(await getAccessToken()).toBe('at-1');
  });
});

describe('safeReturnUrl — các biến thể open redirect khác', () => {
  it.each([
    ['\\\\site-gia.example', 'hai gạch ngược'],
    ['/\t/site-gia.example', 'tab chen giữa hai gạch — bộ phân tích URL bỏ tab'],
    ['/\n/site-gia.example', 'xuống dòng chen giữa hai gạch'],
    ['https:site-gia.example', 'scheme khác origin, không có //'],
    ['data:text/html,<script>alert(1)</script>', 'data URI'],
    [' //site-gia.example', 'khoảng trắng ở đầu'],
  ])('chặn %j (%s)', (raw) => {
    expect(safeReturnUrl(raw)).toBe('/');
  });

  it('đường dẫn đã mã hoá phần trăm ở lại trong app (vẫn là một path, không thành host)', () => {
    expect(safeReturnUrl('/%2F%2Fsite-gia.example')).toBe('/%2F%2Fsite-gia.example');
  });

  it('chuỗi không phân tích được thì về trang mặc định', () => {
    expect(safeReturnUrl('http://[', '/home')).toBe('/home');
  });
});
