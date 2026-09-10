import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultRefreshTokenStore, InMemoryRefreshTokenStore } from '../token-store';

afterEach(() => {
  vi.unstubAllEnvs();
});

function setNodeEnv(value: string) {
  vi.stubEnv('NODE_ENV', value);
}

describe('store mặc định', () => {
  it('cùng MỘT bản cho mọi module — nếu không thì đăng nhập xong là 401 ngay', async () => {
    // Next.js nạp `src/auth.ts` nhiều lần: mỗi route handler là một entry với đồ thị module riêng.
    // Bản ghi phiên được ghi ở `/api/auth/[...nextauth]` và đọc ở `/api/auth/token` — hai module
    // khác nhau. Store treo ở module scope thì hai bên nhìn vào hai bản đồ rỗng khác nhau, và
    // người dùng đăng nhập thành công nhưng `/api/auth/token` trả `SESSION_EXPIRED` tức thì.
    const a = defaultRefreshTokenStore();
    const b = defaultRefreshTokenStore();

    expect(a).toBe(b);

    await a.set('ref-1', { refreshToken: 'rt', subject: 'sub', expiresAt: Date.now() + 60_000 });
    expect(await b.get('ref-1')).not.toBeNull();
    await b.delete('ref-1');
  });

  it('production không cho chạy bản in-memory nếu chưa nói rõ là chấp nhận', () => {
    setNodeEnv('production');
    expect(() => defaultRefreshTokenStore()).toThrow(/InMemoryRefreshTokenStore/);
  });

  it('production + cờ cho phép: chạy, vì có hệ thống thật sự chỉ một instance', () => {
    setNodeEnv('production');
    vi.stubEnv('AUTH_ALLOW_IN_MEMORY_TOKEN_STORE', 'true');
    expect(defaultRefreshTokenStore()).toBeInstanceOf(InMemoryRefreshTokenStore);
  });
});

describe('InMemoryRefreshTokenStore', () => {
  it('bản ghi hết hạn coi như không còn', async () => {
    const store = new InMemoryRefreshTokenStore();
    await store.set('cu', { refreshToken: 'rt', subject: 'sub', expiresAt: Date.now() - 1 });
    expect(await store.get('cu')).toBeNull();
  });

  it('giữ lại access token đã lưu', async () => {
    const store = new InMemoryRefreshTokenStore();
    await store.set('ref', {
      refreshToken: 'rt',
      subject: 'sub',
      expiresAt: Date.now() + 60_000,
      accessToken: 'at',
      accessTokenExpiresAt: Date.now() + 300_000,
    });
    expect((await store.get('ref'))?.accessToken).toBe('at');
  });
});
