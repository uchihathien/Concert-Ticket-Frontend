import { expect, test } from '@playwright/test';
import { FIXTURE, resetStub } from './helpers';

test.beforeEach(async () => {
  await resetStub();
});

test.describe('route cần đăng nhập', () => {
  const protectedPaths = [
    `/booking/${FIXTURE.concert.firstSessionId}`,
    '/me/orders',
    '/me/tickets',
    `/orders/${FIXTURE.paidOrderId}/pay`,
    `/orders/${FIXTURE.paidOrderId}/tickets`,
    '/account',
    '/me/orders?tab=paid&page=2',
  ];

  for (const target of protectedPaths) {
    test(`chưa đăng nhập vào ${target} thì về /login, returnUrl giữ đúng đích`, async ({ page }) => {
      await page.goto(target);
      await page.waitForURL((url) => url.pathname === '/login');

      const returnUrl = new URL(page.url()).searchParams.get('returnUrl');
      expect(returnUrl).toBe(target);
      // Ô ẩn của form đăng nhập mang đúng đích đã lọc.
      await expect(page.locator('input[name="returnUrl"]').first()).toHaveValue(target);
    });
  }

  test('trang công khai không bị chặn', async ({ page }) => {
    for (const open of ['/', '/events', `/events/${FIXTURE.concert.slug}`, '/terms', '/privacy', '/me/saved']) {
      await page.goto(open);
      expect(new URL(page.url()).pathname, open).toBe(open);
    }
  });

  test('tiền tố gần giống trang công khai (/eventsx) vẫn bị chặn', async ({ page }) => {
    await page.goto('/eventsx');
    await page.waitForURL((url) => url.pathname === '/login');
  });
});

test.describe('trang đăng nhập', () => {
  test('hiện đủ các lối vào: email, Google, tạo tài khoản', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Đăng nhập để mua vé' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Đăng nhập bằng email' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Google/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tạo tài khoản mới' })).toBeVisible();
  });

  for (const evil of [
    'https://site-gia.example/login',
    '//site-gia.example',
    '/\\site-gia.example',
    'javascript:alert(1)',
  ]) {
    test(`returnUrl trỏ ra ngoài (${evil}) bị thay bằng "/"`, async ({ page }) => {
      await page.goto(`/login?returnUrl=${encodeURIComponent(evil)}`);
      const hidden = page.locator('input[name="returnUrl"]');
      await expect(hidden.first()).toHaveValue('/');
      for (const value of await hidden.evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value))) {
        expect(value).toBe('/');
      }
    });
  }

  test('/auth/start từ trang khác (Sec-Fetch-Site: cross-site) bị đẩy về /login — chặn login CSRF', async ({
    request,
  }) => {
    const response = await request.get('/auth/start?mode=login', {
      headers: { 'Sec-Fetch-Site': 'cross-site' },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(303);
    expect(response.headers().location).toBe('/login');
  });

  test('/auth/start với returnTo trỏ ra ngoài vẫn quay về trong app sau khi đăng nhập', async ({
    page,
  }) => {
    await page.goto(`/auth/start?mode=login&returnTo=${encodeURIComponent('https://site-gia.example')}`);
    // Issuer giả tự đồng ý và trả về callback; Auth.js chuyển tiếp tới redirectTo đã lọc.
    await page.waitForURL((url) => url.hostname === 'localhost' && url.pathname === '/');
    expect(new URL(page.url()).hostname).toBe('localhost');
  });
});
