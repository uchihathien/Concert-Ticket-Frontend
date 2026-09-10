import { describe, expect, it } from 'vitest';
import { ensureAccessToken } from '../access-token';
import { RedisRefreshTokenStore, type RedisLike } from '../redis-store';

/** Redis giả: một Map kèm hạn, đủ để kiểm hợp đồng mà lớp store dựa vào. */
class FakeRedis implements RedisLike {
  readonly entries = new Map<string, { value: string; expiresAt: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(
    key: string,
    value: string,
    _mode: 'PX',
    ttlMs: number,
    condition?: 'NX',
  ): Promise<string | null> {
    if (condition === 'NX' && (await this.get(key)) !== null) return null;
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
    return 'OK';
  }

  async del(key: string): Promise<unknown> {
    return this.entries.delete(key);
  }
}

function entry(overrides: Record<string, unknown> = {}) {
  return {
    refreshToken: 'rt',
    subject: 'sub-1',
    expiresAt: Date.now() + 30 * 24 * 3600_000,
    accessToken: 'at',
    accessTokenExpiresAt: Date.now() + 300_000,
    ...overrides,
  };
}

describe('RedisRefreshTokenStore', () => {
  it('ghi rồi đọc lại ra đúng bản ghi', async () => {
    const store = new RedisRefreshTokenStore(new FakeRedis());
    await store.set('ref-1', entry());

    expect(await store.get('ref-1')).toMatchObject({ refreshToken: 'rt', subject: 'sub-1' });
  });

  it('TTL lấy từ hạn của refresh token — bản ghi tự biến mất, không cần job dọn', async () => {
    const redis = new FakeRedis();
    const store = new RedisRefreshTokenStore(redis);
    await store.set('ref-1', entry({ expiresAt: Date.now() + 10_000 }));

    const stored = redis.entries.get('nexaticket:session:ref-1');
    expect(stored!.expiresAt - Date.now()).toBeLessThanOrEqual(10_000);
    expect(stored!.expiresAt - Date.now()).toBeGreaterThan(8_000);
  });

  it('bản ghi quá hạn bị coi như không có, dù Redis còn giữ', async () => {
    // Xảy ra khi khôi phục từ backup hoặc đổi định dạng: một bản ghi cũ không được phép hồi sinh
    // một phiên mà lẽ ra đã chết.
    const redis = new FakeRedis();
    redis.entries.set('nexaticket:session:ref-1', {
      value: JSON.stringify(entry({ expiresAt: Date.now() - 1 })),
      expiresAt: Date.now() + 60_000,
    });

    expect(await new RedisRefreshTokenStore(redis).get('ref-1')).toBeNull();
  });

  it('giá trị hỏng trả null thay vì ném', async () => {
    // Ném ở đây biến một bản ghi lỗi thành 500 trên MỌI request của đúng người dùng đó, và họ
    // không có cách nào tự thoát.
    const redis = new FakeRedis();
    redis.entries.set('nexaticket:session:ref-1', {
      value: 'khong-phai-json',
      expiresAt: Date.now() + 60_000,
    });

    expect(await new RedisRefreshTokenStore(redis).get('ref-1')).toBeNull();
  });

  it('khoá làm mới: chỉ một instance giành được, nhả rồi thì instance sau lấy được', async () => {
    // Keycloak xoay vòng refresh token với refreshTokenMaxReuse = 0. Hai instance cùng đổi một lúc
    // thì bản đến sau nhận `invalid_grant` — lỗi không cứu được, phiên bị xoá giữa chừng.
    const store = new RedisRefreshTokenStore(new FakeRedis());

    const first = await store.acquireRefreshLock('ref-1');
    const second = await store.acquireRefreshLock('ref-1');

    expect(first).not.toBeNull();
    expect(second).toBeNull();

    await first!();
    expect(await store.acquireRefreshLock('ref-1')).not.toBeNull();
  });

  it('kẻ thua khoá đọc lại store và dùng token mà kẻ thắng vừa ghi', async () => {
    // Không chờ khoá: chờ nghĩa là giữ luồng cho một việc mà kẻ thắng sắp ghi kết quả vào store.
    const redis = new FakeRedis();
    const store = new RedisRefreshTokenStore(redis);
    await store.set('ref-1', entry({ accessTokenExpiresAt: Date.now() - 1_000 }));

    // Một instance khác đang giữ khoá...
    await store.acquireRefreshLock('ref-1');
    // ...và vừa ghi xong token mới.
    await store.set('ref-1', entry({ accessToken: 'at-moi', accessTokenExpiresAt: Date.now() + 300_000 }));

    const state = await ensureAccessToken('ref-1', {
      store,
      issuer: 'https://kc.test/realms/x',
      clientId: 'web-admin',
      clientSecret: 'shh',
    });

    expect(state).toMatchObject({ status: 'active', accessToken: 'at-moi' });
  });
});
