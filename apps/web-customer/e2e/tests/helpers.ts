import { expect, type Page } from '@playwright/test';

export const STUB_URL = process.env.E2E_STUB_URL ?? '';

/** Một request mà máy chủ giả đã nhận — để kiểm app gửi gì lên gateway. */
export interface SeenRequest {
  method: string;
  path: string;
  query: Record<string, string>;
  idempotencyKey: string | null;
  authorized: boolean;
  body: unknown;
}

export async function resetStub(): Promise<void> {
  const response = await fetch(`${STUB_URL}/__reset`, { method: 'POST' });
  expect(response.status).toBe(204);
}

export async function stubRequests(): Promise<SeenRequest[]> {
  return (await fetch(`${STUB_URL}/__requests`)).json() as Promise<SeenRequest[]>;
}

/** Giả lập payOS gọi webhook: đơn sang PAID và vé được phát. */
export async function markOrderPaid(orderId: string): Promise<void> {
  const response = await fetch(`${STUB_URL}/__orders/${orderId}/pay`, { method: 'POST' });
  expect(response.status).toBe(204);
}

/**
 * Đăng nhập qua đúng luồng của app: trang /login → server action `signIn('keycloak')` → issuer
 * (máy chủ giả) → callback của Auth.js → `returnUrl`.
 */
export async function signIn(page: Page, returnUrl: string): Promise<void> {
  await page.goto(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
  await page.getByRole('button', { name: 'Đăng nhập bằng email' }).click();
  await page.waitForURL((url) => url.pathname + url.search === returnUrl);
}

/** Sự kiện cố định trong fixtures/events.json. */
export const FIXTURE = {
  concert: {
    slug: 'dem-nhac-ha-2027',
    title: 'Đêm nhạc Hạ 2027',
    firstSessionId: '5e55a0a1-0000-4000-8000-000000000001',
  },
  play: { slug: 'kich-hai-tet', title: 'Kịch hài Tết Đinh Mùi' },
  run: { slug: 'giai-chay-dem-da-nang', title: 'Giải chạy đêm Đà Nẵng' },
  conference: { slug: 'hoi-thao-ai-2027', title: 'Hội thảo AI ứng dụng 2027' },
  xss: {
    slug: 'xss-check',
    title: '<img src=x onerror="window.__xss=1">Đêm thử XSS',
  },
  paidOrderId: '0bde0000-0000-4000-8000-000000000001',
} as const;
