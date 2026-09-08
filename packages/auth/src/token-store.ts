/**
 * Nơi giữ refresh token — **phía server, luôn luôn**.
 *
 * Luật cứng số 1 của dự án: refresh token không bao giờ rời server. Cookie phiên chỉ mang một
 * tham chiếu ngẫu nhiên tới bản ghi ở đây; kẻ đọc được cookie vẫn không cầm được refresh token.
 *
 * Vì sao không nhét thẳng refresh token vào cookie JWE của Auth.js (cách mặc định của thư viện):
 * cookie đó đi ra trình duyệt ở mọi request. Mã hoá đúng thì vẫn an toàn, nhưng nó biến việc thu
 * hồi phiên thành bất khả — không có bản ghi phía server thì không có gì để xoá.
 */

export interface StoredRefreshToken {
  refreshToken: string;
  /** `sub` của Keycloak. Dùng để thu hồi toàn bộ phiên của một người. */
  subject: string;
  expiresAt: number;
}

export interface RefreshTokenStore {
  get(ref: string): Promise<StoredRefreshToken | null>;
  set(ref: string, value: StoredRefreshToken): Promise<void>;
  delete(ref: string): Promise<void>;
}

/**
 * Bản lưu trong tiến trình — chỉ dùng cho `next dev`.
 *
 * Production chạy nhiều instance và Next.js tái tạo tiến trình liên tục: bản này sẽ làm người
 * dùng bị đăng xuất ngẫu nhiên. Cắm bản Redis vào `createNexaAuth({ refreshTokenStore })`.
 */
export class InMemoryRefreshTokenStore implements RefreshTokenStore {
  private readonly entries = new Map<string, StoredRefreshToken>();

  async get(ref: string): Promise<StoredRefreshToken | null> {
    const entry = this.entries.get(ref);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(ref);
      return null;
    }
    return entry;
  }

  async set(ref: string, value: StoredRefreshToken): Promise<void> {
    this.entries.set(ref, value);
  }

  async delete(ref: string): Promise<void> {
    this.entries.delete(ref);
  }
}

let warned = false;

export function defaultRefreshTokenStore(): RefreshTokenStore {
  if (process.env.NODE_ENV === 'production' && !warned) {
    warned = true;
    console.warn(
      '[@nexaticket/auth] Đang dùng InMemoryRefreshTokenStore ở production. ' +
        'Nhiều instance sẽ không thấy phiên của nhau — cắm store dùng chung (Redis) vào createNexaAuth.',
    );
  }
  return new InMemoryRefreshTokenStore();
}

export function newTokenRef(): string {
  return crypto.randomUUID();
}
