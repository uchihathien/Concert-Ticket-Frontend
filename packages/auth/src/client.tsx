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

/** Tăng mỗi lần trạng thái phiên đổi. Kết quả của lời gọi phát trước đó bị bỏ qua. */
let generation = 0;

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
  if (!inFlight) {
    const attempt = fetchAccessToken(generation).finally(() => {
      // So bằng danh tính: `clearAccessToken` có thể đã bỏ lời gọi này và bắt đầu lời gọi khác,
      // và khi đó `finally` của bản cũ không được phép xoá bản mới.
      if (inFlight === attempt) inFlight = null;
    });
    inFlight = attempt;
  }
  return inFlight;
}

async function fetchAccessToken(startedAt: number): Promise<string | null> {
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
    markSessionExpired();
    return null;
  }
  // 503 (`IDP_UNAVAILABLE`) và mọi lỗi khác: KHÔNG xoá phiên. Keycloak trục trặc là chuyện tạm
  // thời, còn đăng xuất người dùng thì không.
  if (!response.ok) return cached?.accessToken ?? null;

  const body = (await response.json()) as { accessToken: string; expiresAt: number };
  // Kết quả của một lần hỏi đã bị bỏ thì không được ghi đè bộ nhớ: nó trả lời cho trạng thái
  // phiên CŨ. Đúng cảnh xảy ra trong luồng popup — người dùng đăng nhập xong, `clearAccessToken`
  // chạy, mà request "chưa đăng nhập" phát trước đó mới về tới nơi.
  if (startedAt !== generation) return body.accessToken;
  cached = { accessToken: body.accessToken, expiresAt: body.expiresAt };
  return cached.accessToken;
}

/**
 * Gọi khi đăng nhập xong, khi đăng xuất, hoặc khi backend trả 401 giữa chừng.
 *
 * Bỏ luôn lời gọi đang bay: nó được phát khi trạng thái phiên còn khác, nên câu trả lời của nó
 * không còn đúng nữa.
 */
export function clearAccessToken(): void {
  cached = null;
  inFlight = null;
  generation += 1;
}

/**
 * Đánh dấu phiên đã chết và báo cho mọi nơi đang nghe.
 *
 * Khác {@link clearAccessToken} ở chỗ nó **thông báo**. `clearAccessToken` chỉ có nghĩa "token
 * trong tay đã cũ, đi lấy bản mới" — dùng ngay sau khi đăng nhập xong. Hàm này có nghĩa "phiên
 * không còn nữa", và giao diện phải phản ứng.
 *
 * Người gọi chính là `onUnauthenticated` của `ApiClient`: gateway trả 401 là bằng chứng mạnh nhất
 * về việc phiên đã chết — mạnh hơn `/api/auth/token`, vì đường đó chỉ hỏi Keycloak, mà Keycloak
 * không biết gì về việc identity-service đã thu hồi phiên hay khoá tài khoản.
 */
export function markSessionExpired(): void {
  cached = null;
  inFlight = null;
  generation += 1;
  expiredListeners.forEach((listener) => listener());
}

/**
 * Dựng handler cho `onUnauthenticated` của `ApiClient`: xoá phiên rồi đưa về trang đăng nhập.
 *
 * Ba app quản trị đều cần đúng hành vi này, nên nó nằm ở đây thay vì được chép ba lần — ba bản sao
 * là ba chỗ để một bản quên mất một trong ba chi tiết bên dưới.
 *
 * <ol>
 *   <li><b>Chỉ chạy ở trình duyệt.</b> Cùng module được nạp ở phía server khi render; `window`
 *       không tồn tại ở đó, và chạm vào nó là một lỗi render chứ không phải một lần chuyển hướng.
 *   <li><b>Không chuyển hướng khi đã ở trang đăng nhập.</b> Trang đó cũng gọi API, và một 401 ở
 *       đó sẽ tạo vòng lặp tải lại vô tận.
 *   <li><b>Chỉ chuyển hướng một lần.</b> Một màn hình gọi năm API song song thì cả năm cùng nhận
 *       401; thiếu cờ này là năm lệnh điều hướng chồng lên nhau.
 * </ol>
 *
 * Giữ đường đang xem trong `returnUrl` để sau khi đăng nhập lại quay về đúng chỗ — cùng quy ước
 * với middleware, và `safeReturnUrl` phía trang đăng nhập vẫn lọc lại giá trị đó.
 */
export function createSignInRedirect(signInPath = '/login'): () => void {
  let redirecting = false;

  return () => {
    markSessionExpired();

    if (typeof window === 'undefined' || redirecting) return;
    if (window.location.pathname.startsWith(signInPath)) return;

    redirecting = true;
    const returnUrl = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`${signInPath}?returnUrl=${encodeURIComponent(returnUrl)}`);
  };
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
