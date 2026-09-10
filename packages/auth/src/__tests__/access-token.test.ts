import { describe, expect, it, vi } from 'vitest';
import { ensureAccessToken, type AccessTokenDeps } from '../access-token';
import {
  InMemoryRefreshTokenStore,
  type RefreshTokenStore,
  type StoredRefreshToken,
} from '../token-store';

const ISSUER = 'https://kc.example/realms/nexaticket';

function tokenResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function seed(entry: Partial<StoredRefreshToken>) {
  const store = new InMemoryRefreshTokenStore();
  const ref = 'ref-1';
  await store.set(ref, {
    refreshToken: 'rt-cu',
    subject: 'sub-1',
    expiresAt: Date.now() + 30 * 24 * 3600_000,
    ...entry,
  });
  return { store, ref };
}

function deps(store: AccessTokenDeps['store']): AccessTokenDeps {
  return { store, issuer: ISSUER, clientId: 'web-customer', clientSecret: 'shh' };
}

describe('ensureAccessToken', () => {
  it('token còn hạn thì dùng lại, không gọi Keycloak', async () => {
    const fetchImpl = vi.fn();
    vi.stubGlobal('fetch', fetchImpl);
    const { store, ref } = await seed({
      accessToken: 'at-con-han',
      accessTokenExpiresAt: Date.now() + 300_000,
    });

    const state = await ensureAccessToken(ref, deps(store));

    expect(state).toMatchObject({ status: 'active', accessToken: 'at-con-han' });
    expect(fetchImpl).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('hết hạn thì làm mới, và bản mới nằm ở STORE chứ không ở cookie', async () => {
    // Đây là lỗi cũ: token mới chỉ tồn tại trong `Set-Cookie` mà nhánh RSC của next-auth vứt đi,
    // nên lần đọc sau vẫn ra bản cũ đã hết hạn và mọi lời gọi API nhận 401.
    vi.stubGlobal('fetch', async () =>
      tokenResponse({ access_token: 'at-moi', expires_in: 300, refresh_token: 'rt-moi' }),
    );
    const { store, ref } = await seed({
      accessToken: 'at-het-han',
      accessTokenExpiresAt: Date.now() - 1_000,
    });

    const state = await ensureAccessToken(ref, deps(store));

    expect(state).toMatchObject({ status: 'active', accessToken: 'at-moi' });
    const stored = await store.get(ref);
    expect(stored?.accessToken).toBe('at-moi');
    // Keycloak xoay vòng refresh token: không ghi đè là lần đổi sau hỏng.
    expect(stored?.refreshToken).toBe('rt-moi');
    vi.unstubAllGlobals();
  });

  it('không bao giờ phát ra token đã hết hạn', async () => {
    vi.stubGlobal('fetch', async () => tokenResponse({ error: 'invalid_grant' }, 400));
    const { store, ref } = await seed({
      accessToken: 'at-het-han',
      accessTokenExpiresAt: Date.now() - 1_000,
    });

    const state = await ensureAccessToken(ref, deps(store));

    expect(state.status).toBe('expired');
    expect(state).not.toHaveProperty('accessToken');
  });

  it('hai lời gọi song song chỉ đổi token MỘT lần', async () => {
    // Refresh token bị xoay vòng, nên bản thứ hai gửi cùng một token cũ sẽ nhận `invalid_grant`
    // — và `invalid_grant` là lỗi không cứu được, tức là người dùng bị đá ra đăng nhập lại giữa
    // chừng chỉ vì hai tab cùng hỏi một lúc.
    let calls = 0;
    vi.stubGlobal('fetch', async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return tokenResponse({ access_token: 'at-moi', expires_in: 300, refresh_token: 'rt-moi' });
    });
    const { store, ref } = await seed({ accessTokenExpiresAt: Date.now() - 1_000 });

    const [a, b] = await Promise.all([
      ensureAccessToken(ref, deps(store)),
      ensureAccessToken(ref, deps(store)),
    ]);

    expect(calls).toBe(1);
    expect(a).toMatchObject({ status: 'active', accessToken: 'at-moi' });
    expect(b).toMatchObject({ status: 'active', accessToken: 'at-moi' });
    vi.unstubAllGlobals();
  });

  it('lời gọi đọc store TRƯỚC, chạy tiếp SAU: không được đổi bằng refresh token đã xoay vòng', async () => {
    // Race thật, tái hiện bằng cách điều khiển thời điểm `store.get` trả về.
    //
    // `ensureAccessToken` đọc store TRƯỚC khi kiểm `inFlight`, và giữa hai bước có một `await`.
    // Trình tự hỏng:
    //   1. B đọc store → nhận bản cũ (rt-cu).
    //   2. A đổi xong: ghi rt-moi vào store, rồi `finally` xoá suất của mình.
    //   3. B chạy tiếp, thấy `inFlight` rỗng, và đổi bằng rt-cu — bản đã chết.
    // Keycloak trả `invalid_grant`; đó là lỗi không cứu được nên phiên bị xoá và người dùng bị đá
    // ra đăng nhập lại giữa chừng.
    //
    // Với store trong tiến trình cửa sổ này gần như không mở. Với Redis — bắt buộc ở production —
    // nó rộng đúng bằng một vòng mạng.
    let calls = 0;
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      calls += 1;
      const sent = new URLSearchParams(String(init.body)).get('refresh_token');
      // Đúng hành vi của realm: revokeRefreshToken = true, refreshTokenMaxReuse = 0.
      if (sent !== 'rt-cu') return tokenResponse({ error: 'invalid_grant' }, 400);
      return tokenResponse({ access_token: 'at-moi', expires_in: 300, refresh_token: 'rt-moi' });
    });

    const inner = new InMemoryRefreshTokenStore();
    const ref = 'ref-race';
    await inner.set(ref, {
      refreshToken: 'rt-cu',
      subject: 'sub-1',
      expiresAt: Date.now() + 30 * 24 * 3600_000,
      accessToken: 'at-cu',
      accessTokenExpiresAt: Date.now() - 1_000,
    });

    // Lần `get` đầu tiên bị treo lại cho tới khi test cho phép — đó là lời gọi B.
    let releaseFirstGet: (() => void) | null = null;
    const firstGetIssued = new Promise<void>((resolve) => {
      releaseFirstGet = resolve;
    });
    let getCount = 0;

    const store: RefreshTokenStore = {
      async get(key) {
        getCount += 1;
        if (getCount === 1) {
          const snapshot = await inner.get(key);
          await firstGetIssued; // B cầm bản cũ, rồi ngủ cho tới khi A xong hẳn
          return snapshot;
        }
        return inner.get(key);
      },
      set: (key, value) => inner.set(key, value),
      delete: (key) => inner.delete(key),
    };

    const d = deps(store);
    const b = ensureAccessToken(ref, d); // đọc store, rồi treo
    await vi.waitFor(() => expect(getCount).toBe(1));

    await ensureAccessToken(ref, d); // A: chạy trọn vẹn, kể cả `finally` xoá suất
    releaseFirstGet!(); // B tỉnh dậy với bản cũ trong tay

    const state = await b;

    // Bản cũ: B gửi rt-cu lần hai → invalid_grant → status 'expired', phiên bị xoá.
    // Bản đã sửa: B đọc lại store sau khi giành được suất, thấy token còn hạn, không gọi Keycloak.
    expect(state).toMatchObject({ status: 'active', accessToken: 'at-moi' });
    expect(calls).toBe(1);
    expect(await inner.get(ref)).not.toBeNull();
    vi.unstubAllGlobals();
  });

  it('Keycloak sập: giữ phiên, báo unavailable thay vì đăng xuất', async () => {
    vi.stubGlobal('fetch', async () => tokenResponse({ error: 'temporarily_unavailable' }, 503));
    const { store, ref } = await seed({ accessTokenExpiresAt: Date.now() - 1_000 });

    const state = await ensureAccessToken(ref, deps(store));

    expect(state.status).toBe('unavailable');
    expect(await store.get(ref)).not.toBeNull();
    vi.unstubAllGlobals();
  });

  it('phiên bị thu hồi (không còn bản ghi ở store) là hết hạn', async () => {
    const store = new InMemoryRefreshTokenStore();
    expect(await ensureAccessToken('ref-la', deps(store))).toEqual({ status: 'expired' });
  });

  it('không có tham chiếu nghĩa là chưa đăng nhập', async () => {
    const store = new InMemoryRefreshTokenStore();
    expect(await ensureAccessToken(undefined, deps(store))).toEqual({ status: 'anonymous' });
  });
});
