/**
 * Nơi giữ token của một phiên — **phía server, luôn luôn**.
 *
 * Luật cứng số 1 của dự án: refresh token không bao giờ rời server. Cookie phiên chỉ mang một
 * tham chiếu ngẫu nhiên tới bản ghi ở đây; kẻ đọc được cookie vẫn không cầm được refresh token.
 *
 * Vì sao không nhét thẳng refresh token vào cookie JWE của Auth.js (cách mặc định của thư viện):
 * cookie đó đi ra trình duyệt ở mọi request. Mã hoá đúng thì vẫn an toàn, nhưng nó biến việc thu
 * hồi phiên thành bất khả — không có bản ghi phía server thì không có gì để xoá.
 *
 * <p><b>Access token cũng nằm ở đây</b>, không nằm trong cookie. Lý do dài và không hiển nhiên:
 * xem đầu file `access-token.ts`. Tóm tắt: cookie không ghi lại được ở nhánh RSC của next-auth,
 * nên mọi giá trị **xoay vòng** phải nằm ngoài cookie. Thứ duy nhất cookie mang là `refreshRef`,
 * và nó không bao giờ đổi trong suốt phiên.
 */

export interface StoredRefreshToken {
  /** Chuỗi rỗng nghĩa là IdP không cấp refresh token: phiên chết khi access token hết hạn. */
  refreshToken: string;
  /** `sub` của Keycloak. Dùng để thu hồi toàn bộ phiên của một người. */
  subject: string;
  /** Hạn của refresh token, epoch ms. Hết hạn thì cả bản ghi bị bỏ. */
  expiresAt: number;
  /** Access token hiện hành. Xoay vòng liên tục, nên không bao giờ được sao vào cookie. */
  accessToken?: string;
  /** Epoch ms. */
  accessTokenExpiresAt?: number;
}

export interface RefreshTokenStore {
  get(ref: string): Promise<StoredRefreshToken | null>;
  set(ref: string, value: StoredRefreshToken): Promise<void>;
  delete(ref: string): Promise<void>;
  /**
   * Giành quyền làm mới token cho một phiên, trên TOÀN CỤM.
   *
   * <p>Tuỳ chọn: bản in-memory không cần (một tiến trình thì map `inFlight` đã đủ). Bản dùng chung
   * thì cần, và đây là lý do — Keycloak xoay vòng refresh token với `refreshTokenMaxReuse: 0`, nên
   * hai instance cùng đổi một lúc sẽ khiến bản đến sau nhận `invalid_grant`, và lỗi đó không cứu
   * được: phiên bị xoá, người dùng bị đá ra giữa chừng.
   *
   * @returns hàm nhả khoá, hoặc `null` nếu instance khác đang giữ
   */
  acquireRefreshLock?(ref: string): Promise<(() => Promise<void>) | null>;
}

/** Cắt bớt khi bản đồ phình ra; chỉ chạm tới ở bản in-memory. */
const SWEEP_THRESHOLD = 1_000;

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
    // Bản ghi chỉ bị dọn khi có người đọc đúng nó, nên phiên bị bỏ rơi (người dùng đóng tab và
    // không quay lại) sẽ nằm lại tới 30 ngày. Quét khi bản đồ phình ra là đủ: đây là bản dev.
    if (this.entries.size >= SWEEP_THRESHOLD) this.sweep();
    this.entries.set(ref, value);
  }

  async delete(ref: string): Promise<void> {
    this.entries.delete(ref);
  }

  private sweep(): void {
    const now = Date.now();
    for (const [ref, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(ref);
    }
  }
}

/**
 * Cho phép chạy bản in-memory ở production. Chỉ dùng khi thật sự có một instance duy nhất.
 */
const ALLOW_IN_MEMORY = 'AUTH_ALLOW_IN_MEMORY_TOKEN_STORE';

/**
 * Bản in-memory PHẢI treo trên `globalThis`, không phải trên module scope.
 *
 * <h3>Vì sao</h3>
 *
 * Next.js không nạp một module đúng một lần. Mỗi route handler là một entry riêng với đồ thị
 * module riêng, và `next dev` còn dựng lại đồ thị đó sau mỗi lần sửa file. Hệ quả: `src/auth.ts`
 * tồn tại nhiều bản trong cùng một tiến trình, mỗi bản mang một `InMemoryRefreshTokenStore` riêng.
 *
 * Bản ghi phiên được GHI ở `/api/auth/[...nextauth]` (lúc callback OIDC) và được ĐỌC ở
 * `/api/auth/token`. Hai route, hai đồ thị module, hai store: đăng nhập xong là
 * `/api/auth/token` trả 401 `SESSION_EXPIRED` ngay lập tức — nhìn từ ngoài đúng như "không đăng
 * nhập được", dù Keycloak đã cấp token và cookie phiên đã đặt.
 *
 * `Symbol.for` chứ không phải một chuỗi: khoá nằm trong registry symbol toàn cục, nên hai bản
 * module khác nhau vẫn lấy ra đúng một khoá.
 */
const GLOBAL_STORE = Symbol.for('nexaticket.auth.refresh-token-store');

type GlobalWithStore = typeof globalThis & { [GLOBAL_STORE]?: RefreshTokenStore };

/**
 * Bản trước chỉ `console.warn` rồi vẫn chạy tiếp. Cảnh báo trong log không cứu được ai: triệu
 * chứng là người dùng bị đăng xuất ngẫu nhiên — mỗi lần Next tái tạo tiến trình hoặc load balancer
 * đổi instance — và không ai nối được hiện tượng đó với một dòng log lúc khởi động.
 *
 * Hỏng ngay và nói rõ thiếu gì thì đắt đúng một lần, lúc triển khai.
 */
export function defaultRefreshTokenStore(): RefreshTokenStore {
  if (process.env.NODE_ENV === 'production' && process.env[ALLOW_IN_MEMORY] !== 'true') {
    throw new Error(
      '[@nexaticket/auth] InMemoryRefreshTokenStore không dùng được ở production: nhiều instance ' +
        'không thấy phiên của nhau và người dùng sẽ bị đăng xuất ngẫu nhiên. Cắm store dùng chung ' +
        `(Redis) vào createNexaAuth({ refreshTokenStore }), hoặc đặt ${ALLOW_IN_MEMORY}=true nếu ` +
        'chắc chắn chỉ có đúng một instance.',
    );
  }
  const scope = globalThis as GlobalWithStore;
  return (scope[GLOBAL_STORE] ??= new InMemoryRefreshTokenStore());
}

export function newTokenRef(): string {
  return crypto.randomUUID();
}
