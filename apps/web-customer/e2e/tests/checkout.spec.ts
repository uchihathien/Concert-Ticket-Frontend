import { expect, test } from '@playwright/test';
import { FIXTURE, markOrderPaid, resetStub, signIn, stubRequests } from './helpers';

/**
 * Hành trình cần đăng nhập.
 *
 * Đăng nhập đi đúng luồng OIDC của app (Auth.js + provider Keycloak) với issuer là máy chủ giả —
 * không tiêm cookie, không sửa mã app. Access token đi qua `/api/auth/token` của app rồi gắn vào
 * `Authorization` khi trình duyệt gọi gateway giả; gateway giả trả 401 nếu thiếu token đó.
 */
test.beforeEach(async () => {
  await resetStub();
});

test('đăng nhập rồi quay về đúng returnUrl; lịch sử đơn hiện đúng trạng thái', async ({ page }) => {
  await signIn(page, '/me/orders');

  await expect(page.getByRole('heading', { level: 1, name: 'Đơn hàng của tôi' })).toBeVisible();
  // Đơn đã thanh toán bắc cầu qua ví vé để có tên sự kiện.
  await expect(page.getByRole('link', { name: FIXTURE.concert.title })).toBeVisible();
  await expect(page.getByText('Đã thanh toán', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('Quá hạn chuyển khoản')).toBeVisible();

  // Trình duyệt gọi gateway CÓ token — không phải gọi trần rồi được stub cho qua.
  const mine = (await stubRequests()).filter((r) => r.path === '/v1/me/orders');
  expect(mine.length).toBeGreaterThan(0);
  expect(mine.every((r) => r.authorized)).toBe(true);
});

test('mua vé: chọn khu → giữ chỗ → đặt đơn → trang thanh toán → tiền về → trang vé', async ({
  page,
}) => {
  await signIn(page, `/events/${FIXTURE.concert.slug}`);

  await page.locator('#thong-tin-ve').getByRole('link', { name: 'Chọn chỗ' }).first().click();
  await page.waitForURL(`**/booking/${FIXTURE.concert.firstSessionId}`);
  await expect(page.getByRole('heading', { level: 1, name: FIXTURE.concert.title })).toBeVisible();

  // Khu A: 4 ghế trống (1 đã bán, 1 đang giữ trong fixture). Sàn đứng: 50 chỗ.
  await expect(page.getByText('Còn 4 ghế')).toBeVisible();
  await page.getByRole('button', { name: 'Thêm một vé Khu A' }).click();
  await page.getByRole('button', { name: 'Thêm một vé Khu A' }).click();
  await page.getByRole('button', { name: 'Thêm một vé Vé đứng' }).click();
  // Dòng "N vé đã chọn" chỉ hiện ở màn hẹp; ở desktop số vé nằm cạnh "Tạm tính".
  await expect(page.getByText('· 3 vé', { exact: true })).toBeVisible();

  const submit = page.getByRole('button', { name: 'Giữ chỗ và thanh toán' });
  await expect(submit).toBeDisabled();
  await page.getByRole('checkbox').check();
  await submit.click();

  await page.waitForURL(/\/orders\/[^/]+\/pay$/);
  const orderId = page.url().split('/orders/')[1]!.split('/')[0]!;

  await expect(page.getByRole('heading', { level: 1, name: 'Thanh toán' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Thanh toán qua payOS' })).toHaveAttribute(
    'href',
    /\/payos\/checkout\/NT\d+$/,
  );
  // 2 × 1.500.000 + 450.000 = 3.450.000.
  // Số tiền cũng lặp ở đầu thẻ nhưng chỉ hiện ở màn hẹp — kiểm ở cột tóm tắt.
  await expect(page.locator('aside').getByText(/3\.450\.000\s₫/).first()).toBeVisible();
  await expect(page.getByRole('timer')).toBeVisible();
  await expect(page.getByRole('heading', { name: FIXTURE.concert.title })).toBeVisible();

  // Giữ chỗ và đặt đơn đều mang Idempotency-Key, và là HAI khoá khác nhau.
  const requests = await stubRequests();
  const hold = requests.find((r) => r.method === 'POST' && r.path.endsWith('/holds'))!;
  const order = requests.find((r) => r.method === 'POST' && r.path === '/v1/orders')!;
  expect(hold.body).toEqual({
    seatIds: [],
    seatedZones: [{ zoneCode: 'A', quantity: 2 }],
    standing: [{ zoneCode: 'SAN', quantity: 1 }],
  });
  expect(hold.idempotencyKey).toBeTruthy();
  expect(order.idempotencyKey).toBeTruthy();
  expect(order.idempotencyKey).not.toBe(hold.idempotencyKey);

  // payOS báo tiền về — trang tự hỏi lại (5 giây một lần) và chuyển sang bước nhận vé.
  await markOrderPaid(orderId);
  await page.waitForURL(`**/orders/${orderId}/tickets`, { timeout: 30_000 });
  await expect(page.getByText(/Đã phát 3 vé cho đơn NT\d+/)).toBeVisible();
});

test('huỷ đơn chưa thanh toán từ danh sách đơn', async ({ page }) => {
  // Tạo một đơn chờ tiền qua đúng giao diện chọn chỗ.
  await signIn(page, `/booking/${FIXTURE.concert.firstSessionId}`);
  await page.getByRole('button', { name: 'Thêm một vé Vé đứng' }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Giữ chỗ và thanh toán' }).click();
  await page.waitForURL(/\/orders\/[^/]+\/pay$/);

  await page.goto('/me/orders');
  const filters = page.getByRole('group', { name: 'Lọc đơn hàng' });
  await filters.getByRole('button', { name: /^Chờ thanh toán/ }).click();
  await page.getByRole('button', { name: 'Huỷ đơn' }).click();

  await expect(page.getByText('Đã huỷ đơn')).toBeVisible();
  await filters.getByRole('button', { name: /^Tất cả/ }).click();
  await expect(page.getByText('Bạn đã huỷ')).toBeVisible();
  const cancels = (await stubRequests()).filter((r) => r.path.endsWith('/cancel'));
  expect(cancels).toHaveLength(1);
  expect(cancels[0]!.authorized).toBe(true);
});

test('ví vé hiện vé đã phát của người dùng', async ({ page }) => {
  await signIn(page, '/me/tickets');
  await expect(page.getByRole('link', { name: FIXTURE.concert.title }).first()).toBeVisible();
  // Mã QR chỉ mở khi khách bấm — để không chìa nhầm mã ở cửa.
  await expect(page.getByLabel(/Mã vào cửa/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Hiện mã QR' }).first().click();
  await expect(page.getByLabel('Mã vào cửa cho Vé đứng').first()).toBeVisible();
});
