import type { NexaApp } from './config';

/**
 * Tên cookie phải mang tên app, không được dùng tên mặc định của Auth.js.
 *
 * <h3>Vì sao</h3>
 *
 * Cookie **không phân biệt cổng**. `localhost:3000`, `:3001`, `:3002` và `:3003` là cùng một
 * host với trình duyệt, nên bốn app dev dùng chung đúng một kho cookie. Với tên mặc định
 * (`authjs.session-token`, `authjs.pkce.code_verifier`, …) cả bốn ghi đè lên nhau.
 *
 * Hậu quả, tất cả đều từ một nguyên nhân này:
 *
 * 1. Đăng nhập app này làm mất phiên app kia — chỉ giữ được một phiên tại một thời điểm.
 * 2. Middleware của app tổ chức thấy cookie do app khách phát và cho đi tiếp: vào được khu quản
 *    trị mà chưa từng đăng nhập ở đó. Backend vẫn chặn, nhưng lớp chặn đầu thì đã thủng.
 * 3. `/api/auth/token` của app B không tìm thấy `refreshRef` của app A trong store của nó, kết
 *    luận phiên đã chết và **xoá cookie** — nên chỉ cần mở app B là app A bị đăng xuất theo.
 * 4. Hai luồng đăng nhập chạy song song ghi đè `pkce.code_verifier` của nhau, và luồng về trước
 *    hỏng với `OAuthCallbackError: PKCE code_verifier cookie was missing`.
 *
 * Đổi tên là đủ để tách hoàn toàn, kể cả khi bốn app dùng chung `AUTH_SECRET`: Auth.js lấy chính
 * tên cookie phiên làm `salt` khi dẫn xuất khoá mã hoá JWE, nên tên khác thì cookie của app này
 * không giải mã được ở app kia. Dù vậy vẫn nên đặt mỗi app một `AUTH_SECRET` — tên cookie là hàng
 * rào chống nhầm lẫn, secret riêng mới là hàng rào chống lạm quyền.
 *
 * <h3>Ai phải dùng tới</h3>
 *
 * Mọi nơi đọc hoặc xoá cookie phiên bằng tay — `readSessionCookie`, `expiredSessionCookies` — vì
 * chúng không đi qua Auth.js và sẽ tìm nhầm tên mặc định. Sửa tên ở đây mà quên hai chỗ đó thì
 * phiên im lặng trở thành "chưa đăng nhập".
 */

/**
 * Cookie có mang tiền tố bảo mật hay không.
 *
 * <p>`AUTH_URL` là nguồn chân lý duy nhất, cố ý: đoán theo `request.url` thì sau một proxy cắt
 * TLS giao thức luôn là `http`, và đoán sai tiền tố nghĩa là mọi thứ im lặng thành "chưa đăng
 * nhập". Không khai `AUTH_URL` ở production thì giả định https — hỏng theo hướng an toàn: cookie
 * không được gửi đi là lỗi lộ ra ngay, còn mất cờ `Secure` thì không ai thấy.
 */
export function useSecureCookies(): boolean {
  const authUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  if (authUrl) return authUrl.startsWith('https://');
  return process.env.NODE_ENV === 'production';
}

/** Tên cookie phiên — cũng là `salt` mà Auth.js dùng để dẫn xuất khoá mã hoá JWE. */
export function sessionCookieName(app: NexaApp, secure: boolean): string {
  return `${secure ? '__Secure-' : ''}${app}.session-token`;
}

/**
 * Khối `cookies` cho `NextAuthConfig`.
 *
 * <p>Chỉ khai `name`; `options` do Auth.js trộn vào từ bản mặc định (`init.js` dùng deep merge),
 * nên `httpOnly`, `sameSite`, `path` và `maxAge` giữ nguyên hành vi gốc.
 *
 * <p>`csrfToken` mang tiền tố `__Host-` chứ không phải `__Secure-`, đúng như bản mặc định: nó chặt
 * hơn — trình duyệt còn đòi thêm `Path=/` và cấm `Domain`.
 */
export function authCookieNames(app: NexaApp, secure: boolean) {
  const prefix = secure ? '__Secure-' : '';
  return {
    sessionToken: { name: sessionCookieName(app, secure) },
    callbackUrl: { name: `${prefix}${app}.callback-url` },
    csrfToken: { name: `${secure ? '__Host-' : ''}${app}.csrf-token` },
    pkceCodeVerifier: { name: `${prefix}${app}.pkce.code_verifier` },
    state: { name: `${prefix}${app}.state` },
    nonce: { name: `${prefix}${app}.nonce` },
  };
}
