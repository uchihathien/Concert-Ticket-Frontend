'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Access token phía client — **chỉ trong memory**.
 *
 * Luật cứng số 2: không `localStorage`, không `sessionStorage`, không cookie do JS đặt. Biến
 * dưới đây sống trong module scope của tab hiện tại; đóng tab là mất, và không script nào của
 * bên thứ ba đọc được nó qua storage API.
 *
 * Hệ quả phải chấp nhận: mở tab mới là một lần gọi `/api/auth/token`. Đó là cái giá đúng.
 */
let cached: { accessToken: string; expiresAt: number } | null = null;

/** Nhiều component cùng cần token lúc khởi động: gộp thành một request. */
let inFlight: Promise<string | null> | null = null;

const EXPIRY_MARGIN_MS = 30_000;

type SessionListener = () => void;
const expiredListeners = new Set<SessionListener>();

export const TOKEN_ENDPOINT = '/api/auth/token';

/**
 * Lấy access token cho một request.
 *
 * Trả `null` nghĩa là chưa đăng nhập hoặc phiên đã hết hạn — nơi gọi tự quyết định là gọi API
 * công khai hay đẩy người dùng sang trang đăng nhập.
 */
export async function getAccessToken(): Promise<string | null> {
  if (cached && Date.now() < cached.expiresAt - EXPIRY_MARGIN_MS) {
    return cached.accessToken;
  }
  inFlight ??= fetchAccessToken().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function fetchAccessToken(): Promise<string | null> {
  let response: Response;
  try {
    response = await fetch(TOKEN_ENDPOINT, {
      // Cookie phiên là httpOnly và cùng origin — đây là chỗ duy nhất cần gửi nó.
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
  } catch {
    // Mất mạng: đừng xoá token đang có, khách quay lại sóng là dùng tiếp được.
    return cached?.accessToken ?? null;
  }

  if (response.status === 401) {
    cached = null;
    expiredListeners.forEach((listener) => listener());
    return null;
  }
  if (!response.ok) return cached?.accessToken ?? null;

  const body = (await response.json()) as { accessToken: string; expiresAt: number };
  cached = { accessToken: body.accessToken, expiresAt: body.expiresAt };
  return cached.accessToken;
}

/** Gọi khi đăng xuất, hoặc khi backend trả 401 giữa chừng. */
export function clearAccessToken(): void {
  cached = null;
}

export function onSessionExpired(listener: SessionListener): () => void {
  expiredListeners.add(listener);
  return () => expiredListeners.delete(listener);
}

export type SessionState = 'unknown' | 'authenticated' | 'anonymous';

/**
 * Trạng thái phiên cho component client.
 *
 * Dùng khi UI phải rẽ nhánh (hiện nút đăng nhập hay avatar). Component chỉ *gọi API* thì không
 * cần hook này — `ApiClient` tự hỏi `getAccessToken` ở mỗi request.
 */
export function useSessionState(): { state: SessionState; refresh: () => void } {
  const [state, setState] = useState<SessionState>('unknown');

  const refresh = useCallback(() => {
    void getAccessToken().then((token) => setState(token ? 'authenticated' : 'anonymous'));
  }, []);

  useEffect(() => {
    refresh();
    return onSessionExpired(() => setState('anonymous'));
  }, [refresh]);

  return { state, refresh };
}
