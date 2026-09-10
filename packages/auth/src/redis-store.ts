import type { RefreshTokenStore, StoredRefreshToken } from './token-store';

/**
 * Bản {@link RefreshTokenStore} dùng chung giữa nhiều instance.
 *
 * <h3>Vì sao bản in-memory không dùng được ở production</h3>
 *
 * Next.js tái tạo tiến trình liên tục và production chạy nhiều instance sau load balancer. Bản ghi
 * phiên nằm trong bộ nhớ của một tiến trình thì instance kia không thấy: người dùng bị đăng xuất
 * ngẫu nhiên, không theo quy luật nào, và không có log nào giải thích.
 *
 * `defaultRefreshTokenStore()` vì thế **ném lỗi** ở production. Lớp này là thứ nó bảo bạn đi cắm
 * vào — trước đây câu bảo đó không có chỗ nào để đến.
 *
 * <h3>Vì sao không phụ thuộc thẳng vào ioredis</h3>
 *
 * `@nexaticket/auth` được cả bốn app dùng, kể cả `web-scanner` với ngân sách 150KB JS. Kéo một
 * client Redis vào package dùng chung nghĩa là cả bốn app mang nó, dù chỉ tầng server cần.
 *
 * Nhận client theo {@link RedisLike} — một giao diện ba phương thức — thì `ioredis`, `node-redis`
 * và Upstash đều cắm vừa, và package này không thêm phụ thuộc nào. Đổi lại, mỗi app tự khai client
 * của mình; đó là chỗ đúng để khai, vì địa chỉ Redis là cấu hình của môi trường chứ không phải của
 * thư viện.
 */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  /** Đặt giá trị kèm hạn tính bằng mili giây. */
  set(key: string, value: string, mode: 'PX', ttlMs: number): Promise<unknown>;
  /** Đặt CHỈ KHI khoá chưa tồn tại. Trả `null` nghĩa là có người khác giữ trước. */
  set(key: string, value: string, mode: 'PX', ttlMs: number, condition: 'NX'): Promise<string | null>;
  del(key: string): Promise<unknown>;
}

/** Tiền tố để phiên không lẫn với dữ liệu khác trong cùng một Redis. */
const KEY_PREFIX = 'nexaticket:session:';
const LOCK_PREFIX = 'nexaticket:session-lock:';

/**
 * Khoá làm mới sống rất ngắn.
 *
 * Đủ dài để một vòng gọi Keycloak kịp xong, đủ ngắn để một tiến trình chết giữa chừng không khoá
 * phiên của người dùng lâu hơn vài giây.
 */
const LOCK_TTL_MS = 5_000;

export class RedisRefreshTokenStore implements RefreshTokenStore {
  constructor(private readonly redis: RedisLike) {}

  async get(ref: string): Promise<StoredRefreshToken | null> {
    const raw = await this.redis.get(KEY_PREFIX + ref);
    if (!raw) return null;

    try {
      const entry = JSON.parse(raw) as StoredRefreshToken;
      // Redis đã tự hết hạn theo TTL, nhưng vẫn kiểm lại: TTL được đặt từ `expiresAt` lúc GHI, và
      // một bản ghi cũ còn sót (đổi định dạng, khôi phục từ backup) không được phép hồi sinh phiên.
      if (entry.expiresAt <= Date.now()) {
        await this.delete(ref);
        return null;
      }
      return entry;
    } catch {
      // Giá trị hỏng: coi như không có phiên. Ném ở đây sẽ biến một bản ghi lỗi thành lỗi 500 trên
      // mọi request của đúng người dùng đó, và họ không có cách nào tự thoát.
      return null;
    }
  }

  async set(ref: string, value: StoredRefreshToken): Promise<void> {
    // TTL lấy từ chính hạn của refresh token: bản ghi tự biến mất đúng lúc nó hết nghĩa, nên không
    // cần job dọn nào. Kẹp sàn 1 giây vì Redis từ chối TTL âm hoặc bằng 0.
    const ttl = Math.max(1_000, value.expiresAt - Date.now());
    await this.redis.set(KEY_PREFIX + ref, JSON.stringify(value), 'PX', ttl);
  }

  async delete(ref: string): Promise<void> {
    await this.redis.del(KEY_PREFIX + ref);
  }

  /**
   * Giành quyền làm mới token cho một phiên, trên toàn cụm.
   *
   * <h3>Vì sao `inFlight` trong tiến trình là chưa đủ</h3>
   *
   * Keycloak **xoay vòng** refresh token và realm đặt `refreshTokenMaxReuse: 0`: bản cũ chết ngay
   * khi bản mới được cấp. Map `inFlight` gộp được các lời gọi trùng nhau trong MỘT tiến trình,
   * nhưng hai instance sau load balancer thì không thấy nhau — cả hai cùng gửi một refresh token,
   * bản đến sau nhận `invalid_grant`, và `invalid_grant` là lỗi không cứu được: phiên bị xoá và
   * người dùng bị đá ra giữa chừng.
   *
   * <p>`SET NX PX` là một thao tác nguyên tử của Redis, nên đúng một instance thắng. Kẻ thua không
   * chờ khoá — nó đọc lại store, vì kẻ thắng sẽ ghi token mới vào đó.
   *
   * @returns hàm nhả khoá, hoặc `null` nếu instance khác đang giữ
   */
  async acquireRefreshLock(ref: string): Promise<(() => Promise<void>) | null> {
    const key = LOCK_PREFIX + ref;
    const acquired = await this.redis.set(key, '1', 'PX', LOCK_TTL_MS, 'NX');
    if (acquired === null) return null;
    return async () => {
      await this.redis.del(key);
    };
  }
}
