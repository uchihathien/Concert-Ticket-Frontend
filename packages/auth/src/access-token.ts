import { RefreshFailedError, refreshAccessToken } from './keycloak';
import type { RefreshTokenStore } from './token-store';

/**
 * Access token sống ở **store phía server**, không sống trong cookie phiên.
 *
 * <h3>Vì sao đổi so với bản trước</h3>
 *
 * Bản trước giữ `accessToken` và `accessTokenExpiresAt` trong cookie JWE và làm mới chúng trong
 * callback `jwt` của Auth.js. Cách đó hỏng ở một chỗ không nhìn ra được từ code của mình:
 * `auth()` gọi không tham số rơi vào nhánh "React Server Components" của next-auth, và nhánh đó
 * **vứt bỏ** `Set-Cookie` mà `@auth/core` trả về. Nghĩa là token vừa làm mới không bao giờ được
 * ghi lại vào cookie.
 *
 * Hệ quả dây chuyền, chỉ lộ ra sau khi access token hết hạn lần đầu (~5 phút):
 *
 * 1. `auth()` chạy callback `jwt` → refresh thật sự xảy ra → Keycloak **xoay vòng** refresh token.
 * 2. Access token mới chỉ nằm trong `Set-Cookie` vừa bị vứt.
 * 3. Nơi đọc token đọc lại cookie CỦA REQUEST — tức bản cũ — nên phát ra một token đã hết hạn.
 * 4. Trình duyệt gửi token đó lên gateway và nhận 401, dù phiên vẫn còn sống hoàn toàn.
 *
 * Triệu chứng người dùng gặp: ngồi yên trên một trang quá năm phút thì mọi lời gọi API hỏng,
 * nhưng bấm sang trang khác lại hết — vì điều hướng đi qua middleware, và nhánh middleware của
 * next-auth thì CÓ giữ lại `Set-Cookie`.
 *
 * <h3>Cách sửa</h3>
 *
 * Thứ duy nhất cookie còn mang là `refreshRef` — một tham chiếu **không bao giờ đổi** trong suốt
 * phiên. Mọi thứ xoay vòng (access token, refresh token, hạn dùng) nằm ở store phía server. Không
 * còn giá trị nào cần ghi ngược vào cookie, nên việc `Set-Cookie` có bị vứt hay không không còn
 * ảnh hưởng tới tính đúng đắn.
 *
 * Đổi lại được thêm hai thứ: cookie nhỏ hẳn (Auth.js không phải cắt nó thành nhiều mảnh), và
 * access token không còn rời khỏi server ở bất kỳ dạng nào — kể cả dạng đã mã hoá.
 */

export interface AccessTokenDeps {
  store: RefreshTokenStore;
  issuer: string;
  clientId: string;
  clientSecret: string;
}

export type AccessTokenState =
  /** Chưa đăng nhập, hoặc cookie không mang tham chiếu nào. */
  | { status: 'anonymous' }
  /** Còn cookie nhưng không làm mới được — UI phải mời đăng nhập lại. */
  | { status: 'expired' }
  /** Keycloak đang trục trặc. Phiên vẫn còn giá trị; nơi gọi phải thử lại, đừng đăng xuất. */
  | { status: 'unavailable' }
  | { status: 'active'; accessToken: string; expiresAt: number; userId: string | null };

/**
 * Đổi token sớm hơn hạn 30 giây.
 *
 * Đúng hạn mới đổi thì request đang bay dở sẽ mang token vừa hết hạn và nhận 401 — người dùng
 * thấy "phiên hết hạn" giữa lúc đang thao tác.
 */
const REFRESH_SKEW_MS = 30_000;

/**
 * Gộp các lần làm mới trùng nhau của cùng một phiên.
 *
 * Keycloak **xoay vòng** refresh token: bản cũ chết ngay khi bản mới được cấp. Hai request cùng
 * hết hạn cùng lúc (hai tab, hoặc hai lời gọi song song) mà cùng gửi một refresh token thì bản
 * đến sau nhận `invalid_grant` — và `invalid_grant` là lỗi KHÔNG cứu được, nên nó xoá bản ghi
 * phiên và đá người dùng ra đăng nhập lại giữa chừng.
 *
 * Map này chỉ gộp được trong MỘT tiến trình. Chạy nhiều instance thì hai instance vẫn có thể cùng
 * đổi một lúc; đó là lý do store dùng chung (Redis) phải là bản có khoá, xem `RefreshTokenStore`.
 */
const inFlight = new Map<string, Promise<AccessTokenState>>();

/**
 * Trả về access token còn hạn cho một phiên, làm mới nếu cần.
 *
 * @param ref `refreshRef` đọc từ cookie phiên
 */
export async function ensureAccessToken(
  ref: string | undefined,
  deps: AccessTokenDeps,
): Promise<AccessTokenState> {
  if (!ref) return { status: 'anonymous' };

  const stored = await deps.store.get(ref);
  if (!stored) {
    // Server khởi động lại (store trong tiến trình) hoặc phiên đã bị thu hồi.
    return { status: 'expired' };
  }

  if (isFresh(stored)) {
    return active(stored.accessToken, stored.accessTokenExpiresAt, stored.subject);
  }

  if (!stored.refreshToken) {
    // Không có refresh token (client OIDC cấu hình thiếu scope `offline_access`, hoặc IdP không
    // cấp): phiên chỉ sống đúng bằng access token đầu tiên, và nó vừa hết hạn.
    return { status: 'expired' };
  }

  // Kiểm rồi đặt trong cùng một lượt đồng bộ — không có `await` nào ở giữa, nên hai lời gọi song
  // song không thể cùng lọt qua.
  const running = inFlight.get(ref);
  if (running) return running;

  const attempt = refreshOnce(ref, deps).finally(() => inFlight.delete(ref));
  inFlight.set(ref, attempt);
  return attempt;
}

/**
 * Đọc lại store **sau khi** đã giành được suất làm mới.
 *
 * <h3>Race mà bước này bịt</h3>
 *
 * `stored` ở {@link ensureAccessToken} được đọc TRƯỚC khi kiểm `inFlight`, và giữa hai bước đó có
 * một `await`. Trình tự hỏng:
 *
 * 1. B đọc store → nhận bản cũ.
 * 2. A hoàn tất vòng đổi: ghi refresh token mới vào store, rồi `finally` xoá suất của mình.
 * 3. B kiểm `inFlight` → rỗng → đổi token bằng **refresh token cũ** đọc ở bước 1.
 *
 * Realm đặt `revokeRefreshToken: true` và `refreshTokenMaxReuse: 0`, nên bản cũ đã chết: Keycloak
 * trả `invalid_grant`, và `invalid_grant` là lỗi không cứu được — {@link rotate} xoá bản ghi phiên
 * và người dùng bị đá ra đăng nhập lại giữa chừng.
 *
 * Với store trong tiến trình cửa sổ này gần như không mở. Với Redis — thứ bắt buộc ở production —
 * nó rộng đúng bằng một vòng mạng, và hai tab hỏi cùng lúc là chuyện thường ngày.
 *
 * Đọc lại ở đây rẻ (một lần `get`) và bịt hẳn: bản đọc lần này nằm sau mọi lần ghi đã hoàn tất,
 * vì chỉ có một suất làm mới tại một thời điểm.
 */
async function refreshOnce(ref: string, deps: AccessTokenDeps): Promise<AccessTokenState> {
  // Khoá toàn cụm nếu store hỗ trợ. Map `inFlight` chỉ gộp trong MỘT tiến trình; hai instance sau
  // load balancer không thấy nhau, và cùng gửi một refresh token đã xoay vòng thì bản đến sau nhận
  // `invalid_grant` — lỗi không cứu được, phiên bị xoá giữa chừng.
  const release = deps.store.acquireRefreshLock ? await deps.store.acquireRefreshLock(ref) : noopRelease;

  if (!release) {
    // Instance khác đang đổi. KHÔNG chờ khoá: chờ nghĩa là giữ luồng cho một việc mà kẻ thắng sắp
    // ghi kết quả vào store. Đọc lại là đủ, và nếu chưa kịp thì lần gọi sau của client sẽ thấy.
    const refreshed = await deps.store.get(ref);
    if (refreshed && isFresh(refreshed)) {
      return active(refreshed.accessToken, refreshed.accessTokenExpiresAt, refreshed.subject);
    }
    return { status: 'unavailable' };
  }

  try {
    const stored = await deps.store.get(ref);
    if (!stored) return { status: 'expired' };

    // Một lời gọi khác vừa làm mới xong: dùng luôn kết quả của họ, đừng đổi lần nữa.
    if (isFresh(stored)) {
      return active(stored.accessToken, stored.accessTokenExpiresAt, stored.subject);
    }
    if (!stored.refreshToken) return { status: 'expired' };

    return await rotate(ref, stored, deps);
  } finally {
    await release();
  }
}

/** Store không có khoá (bản in-memory): coi như luôn giành được, và nhả là không làm gì. */
const noopRelease = async () => {};

/** Còn hạn, tính cả biên an toàn. Viết một chỗ để hai nơi kiểm không lệch nhau. */
function isFresh(
  stored: { accessToken?: string; accessTokenExpiresAt?: number },
): stored is { accessToken: string; accessTokenExpiresAt: number } {
  return Boolean(
    stored.accessToken &&
      stored.accessTokenExpiresAt &&
      Date.now() < stored.accessTokenExpiresAt - REFRESH_SKEW_MS,
  );
}

async function rotate(
  ref: string,
  stored: { refreshToken: string; subject: string; expiresAt: number; accessToken?: string; accessTokenExpiresAt?: number },
  deps: AccessTokenDeps,
): Promise<AccessTokenState> {
  try {
    const refreshed = await refreshAccessToken({
      issuer: deps.issuer,
      clientId: deps.clientId,
      clientSecret: deps.clientSecret,
      refreshToken: stored.refreshToken,
    });

    // Keycloak xoay vòng refresh token: không ghi đè là lần đổi sau sẽ hỏng.
    await deps.store.set(ref, {
      ...stored,
      refreshToken: refreshed.refreshToken,
      accessToken: refreshed.accessToken,
      accessTokenExpiresAt: refreshed.expiresAt,
    });

    return active(refreshed.accessToken, refreshed.expiresAt, stored.subject);
  } catch (cause) {
    if (cause instanceof RefreshFailedError && cause.recoverable) {
      // Keycloak trục trặc tạm thời. Đá người dùng ra đăng nhập lại vì một lần 503 là phản ứng
      // thái quá — nhưng cũng KHÔNG phát ra token đã hết hạn, vì nơi nhận sẽ dùng nó và ăn 401.
      if (stored.accessToken && stored.accessTokenExpiresAt && Date.now() < stored.accessTokenExpiresAt) {
        return active(stored.accessToken, stored.accessTokenExpiresAt, stored.subject);
      }
      return { status: 'unavailable' };
    }

    // `invalid_grant`: refresh token hết hạn hoặc đã bị thu hồi. Phiên chấm dứt ở đây.
    await deps.store.delete(ref);
    return { status: 'expired' };
  }
}

function active(accessToken: string, expiresAt: number, userId: string | null): AccessTokenState {
  return { status: 'active', accessToken, expiresAt, userId };
}
