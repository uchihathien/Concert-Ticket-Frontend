import { describe, expect, it, vi } from 'vitest';
import { RefreshFailedError, refreshAccessToken, tokenEndpoint } from '../keycloak';

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const base = {
  issuer: 'http://localhost:8081/realms/nexaticket',
  clientId: 'web-customer',
  clientSecret: 'secret',
  refreshToken: 'rt-1',
};

describe('refreshAccessToken', () => {
  it('gọi đúng token endpoint của realm', async () => {
    const fetchImpl = vi.fn(async (..._args: unknown[]) =>
      response({ access_token: 'at-2', expires_in: 300, refresh_token: 'rt-2' }),
    );

    await refreshAccessToken({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      'http://localhost:8081/realms/nexaticket/protocol/openid-connect/token',
    );
    expect(tokenEndpoint('http://x/realms/y/')).toBe(
      'http://x/realms/y/protocol/openid-connect/token',
    );
  });

  it('trả về refresh token đã xoay vòng — không ghi đè là lần sau hỏng', async () => {
    const fetchImpl = vi.fn(async (..._args: unknown[]) =>
      response({ access_token: 'at-2', expires_in: 300, refresh_token: 'rt-2' }),
    );

    const result = await refreshAccessToken({
      ...base,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.refreshToken).toBe('rt-2');
    expect(result.accessToken).toBe('at-2');
    expect(result.expiresAt).toBeGreaterThan(Date.now());
  });

  it('Keycloak không xoay vòng thì giữ lại bản cũ', async () => {
    const fetchImpl = vi.fn(async (..._args: unknown[]) =>
      response({ access_token: 'at-2', expires_in: 300 }),
    );

    const result = await refreshAccessToken({
      ...base,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.refreshToken).toBe('rt-1');
  });

  it('invalid_grant là không cứu được — phải bắt đăng nhập lại', async () => {
    const fetchImpl = vi.fn(async (..._args: unknown[]) =>
      response({ error: 'invalid_grant' }, 400),
    );

    const error = (await refreshAccessToken({
      ...base,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    }).catch((cause: unknown) => cause)) as RefreshFailedError;

    expect(error).toBeInstanceOf(RefreshFailedError);
    expect(error.recoverable).toBe(false);
  });

  it('Keycloak sập là lỗi cứu được — giữ nguyên phiên, thử lại sau', async () => {
    const fetchImpl = vi.fn(async (..._args: unknown[]) =>
      response({ error: 'temporarily_unavailable' }, 503),
    );

    const error = (await refreshAccessToken({
      ...base,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    }).catch((cause: unknown) => cause)) as RefreshFailedError;

    expect(error.recoverable).toBe(true);
  });
});
