import { expect, test, type Locator, type Page } from '@playwright/test';
import { FIXTURE, resetStub, stubRequests } from './helpers';

test.beforeEach(async () => {
  await resetStub();
});

/** Tên các thẻ sự kiện trong vùng kết quả, theo thứ tự hiển thị. */
async function cardTitles(page: Page): Promise<string[]> {
  return page.locator('main a[href^="/events/"] h3').allTextContents();
}

/**
 * Bấm một link rồi chờ URL đổi. `next dev` thỉnh thoảng nạp lại trang (HMR) ngay sau lần biên dịch
 * đầu, nuốt mất cú bấm đến trước lúc hydrate — bấm lại cho tới khi điều hướng xảy ra.
 */
async function follow(page: Page, link: Locator, url: RegExp): Promise<void> {
  await expect(async () => {
    await link.click();
    await page.waitForURL(url, { timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
}

/** Lần gọi `GET /v1/events` gần nhất mà server Next gửi lên gateway. */
async function lastListQuery(): Promise<Record<string, string>> {
  const list = (await stubRequests()).filter((r) => r.method === 'GET' && r.path === '/v1/events');
  return list.at(-1)?.query ?? {};
}

test.describe('trang chủ', () => {
  test('hiện sự kiện từ API, mỗi thẻ dẫn tới trang chi tiết', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Sự kiện nổi bật' })).toBeVisible();
    // Thẻ sự kiện (có <h3>), không phải nút "Mua vé ngay" của hero trỏ cùng địa chỉ.
    const card = page.locator(`main a[href="/events/${FIXTURE.concert.slug}"]:has(h3)`).first();
    await expect(card).toContainText(FIXTURE.concert.title);
    // Giá "từ" là giá thấp nhất qua mọi suất, định dạng VND.
    await expect(card).toContainText(/Từ 450\.000\s₫/);
    // Hàng thể loại là truy vấn thật bằng `category`, không phải cắt từ danh sách chung.
    await expect(page.getByRole('heading', { name: 'Ca nhạc' }).first()).toBeVisible();
    const categoryCalls = (await stubRequests()).filter((r) => r.query.category === 'nhac-song');
    expect(categoryCalls.length).toBeGreaterThan(0);
  });
});

test.describe('duyệt /events', () => {
  test('liệt kê đủ sự kiện đang bán kèm tổng số', async ({ page }) => {
    await page.goto('/events');
    await expect(page.getByRole('heading', { level: 1, name: 'Sự kiện' })).toBeVisible();
    await expect(page.getByText('5 sự kiện')).toBeVisible();
    expect(await cardTitles(page)).toHaveLength(5);
    expect(await lastListQuery()).toEqual({ page: '0', size: '24' });
  });

  test('tìm kiếm từ ô ở header: từ khoá đi lên gateway thành `query`, kết quả chỉ còn sự kiện khớp', async ({
    page,
  }) => {
    await page.goto('/events');
    const search = page.getByRole('searchbox', { name: 'Tìm sự kiện' }).first();
    await search.fill('kịch hài');
    await search.press('Enter');

    await page.waitForURL(/\/events\?q=/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kết quả cho “kịch hài”');
    await expect.poll(() => cardTitles(page)).toEqual([FIXTURE.play.title]);
    expect((await lastListQuery()).query).toBe('kịch hài');
  });

  test('không có kết quả thì hiện trạng thái rỗng có hướng dẫn', async ({ page }) => {
    await page.goto('/events?q=khong-ton-tai-xyz');
    await expect(page.getByText('Không tìm thấy sự kiện nào')).toBeVisible();
    await expect(page.getByText('Không có sự kiện nào')).toBeVisible();
  });

  test('chip thể loại lọc bằng `category` và giữ trên URL', async ({ page }) => {
    await page.goto('/events');
    await follow(page, page.getByRole('link', { name: 'Thể thao', exact: true }).first(), /category=the-thao/);
    await expect.poll(() => cardTitles(page)).toEqual([FIXTURE.run.title]);
    expect((await lastListQuery()).category).toBe('the-thao');
  });

  test('bộ lọc giá "Dưới 500.000đ" gửi minPrice=0, maxPrice=500000 và giữ sự kiện miễn phí', async ({
    page,
  }) => {
    await page.goto('/events');
    await follow(
      page,
      page.getByRole('complementary', { name: 'Bộ lọc' }).getByRole('link', { name: 'Dưới 500.000đ' }),
      /price=under-500/,
    );

    await expect
      .poll(async () => (await cardTitles(page)).sort())
      // Giá "từ" thấp nhất: giải chạy 0đ, XSS 200.000đ, đêm nhạc 450.000đ. Kịch (800.000đ) và hội thảo
      // (1.200.000đ) nằm ngoài.
      .toEqual([FIXTURE.xss.title, FIXTURE.run.title, FIXTURE.concert.title].sort());
    const query = await lastListQuery();
    expect(query.minPrice).toBe('0');
    expect(query.maxPrice).toBe('500000');
  });

  test('bộ lọc thành phố và "Xoá tất cả"', async ({ page }) => {
    await page.goto('/events');
    const sidebar = page.getByRole('complementary', { name: 'Bộ lọc' });
    await follow(page, sidebar.getByRole('link', { name: 'Hà Nội', exact: true }), /city=/);
    await expect
      .poll(async () => (await cardTitles(page)).sort())
      .toEqual([FIXTURE.concert.title, FIXTURE.conference.title].sort());
    expect((await lastListQuery()).city).toBe('Hà Nội');

    await follow(page, sidebar.getByRole('link', { name: 'Xoá tất cả' }), /\/events$/);
    await expect.poll(() => cardTitles(page)).toHaveLength(5);
  });

  test('bộ lọc thời gian "Tháng này" gửi khoảng ISO nửa mở [from, to)', async ({ page }) => {
    await page.goto('/events?when=month');
    const query = await lastListQuery();
    expect(Date.parse(query.from ?? '')).toBeLessThan(Date.parse(query.to ?? ''));
    // Mọi suất trong fixtures đều ở năm 2027, nên tháng này không có gì.
    await expect(page.getByText('Không tìm thấy sự kiện nào')).toBeVisible();
  });
});

test.describe('chi tiết sự kiện', () => {
  test('hiện địa điểm, các suất theo giờ Việt Nam, hạng vé và giá', async ({ page }) => {
    await page.goto(`/events/${FIXTURE.concert.slug}`);

    await expect(page.getByRole('heading', { level: 1, name: FIXTURE.concert.title })).toBeVisible();
    await expect(page.getByText('Nhà hát Lớn Hà Nội, Hà Nội')).toBeVisible();
    await expect(page.getByText('1 Tràng Tiền, Hoàn Kiếm').first()).toBeVisible();
    await expect(page.getByText('và 1 suất khác')).toBeVisible();

    const tickets = page.locator('#thong-tin-ve');
    // 12:00Z = 19:00 ở Việt Nam; suất kết thúc cùng ngày thì hiện cả giờ kết thúc.
    await expect(tickets.getByText('19:00 – 21:30')).toBeVisible();
    await expect(tickets.getByText(/13\/03\/2027/)).toBeVisible();
    await expect(tickets.getByText(/14\/03\/2027/)).toBeVisible();
    await expect(tickets.getByText('Hạng VIP').first()).toBeVisible();
    await expect(tickets.getByText(/1\.500\.000\s₫/).first()).toBeVisible();
    await expect(tickets.getByText(/450\.000\s₫/).first()).toBeVisible();

    const choose = tickets.getByRole('link', { name: 'Chọn chỗ' }).first();
    await expect(choose).toHaveAttribute('href', `/booking/${FIXTURE.concert.firstSessionId}`);
  });

  test('suất chưa mở bán: nút "Chọn chỗ" bị khoá và nói rõ ngày mở bán', async ({ page }) => {
    await page.goto(`/events/${FIXTURE.conference.slug}`);
    const tickets = page.locator('#thong-tin-ve');
    await expect(tickets.getByRole('button', { name: 'Chọn chỗ' })).toBeDisabled();
    // 02:00Z = 09:00 giờ Việt Nam.
    await expect(tickets.getByText('Mở bán từ 01/02/2027 · 09:00')).toBeVisible();
  });

  /**
   * Trang hiện đúng giao diện 404, nhưng HTTP status là 200: route có `loading.tsx`, nên Next đã
   * stream phần đầu (status 200) trước khi `notFound()` chạy — "soft 404". Next bù bằng
   * `<meta name="robots" content="noindex">`, nên kiểm cả hai. Ghi trong báo cáo.
   */
  test('slug không tồn tại hiện trang 404 của app và không cho máy tìm kiếm lập chỉ mục', async ({
    page,
  }) => {
    await page.goto('/events/khong-co-su-kien-nay');
    await expect(page.getByRole('heading', { level: 1, name: 'Không tìm thấy trang này' })).toBeVisible();
    expect(await page.locator('meta[name="robots"][content*="noindex"]').count()).toBeGreaterThanOrEqual(1);
  });
});

test.describe('XSS từ dữ liệu API', () => {
  test('tiêu đề, tóm tắt, địa điểm, hạng vé chứa HTML được hiện thành CHỮ', async ({ page }) => {
    const dialogs: string[] = [];
    page.on('dialog', (dialog) => {
      dialogs.push(dialog.message());
      void dialog.dismiss();
    });

    await page.goto(`/events/${FIXTURE.xss.slug}`);
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toHaveText(FIXTURE.xss.title);

    // Không phần tử nào do dữ liệu tạo ra: không <img src=x>, không <iframe>, không <b onmouseover>.
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(page.locator('[onmouseover], [onerror], [onload]')).toHaveCount(0);
    await expect(page.getByText('<script>window.__xss=2</script>Tóm tắt có thẻ script')).toBeVisible();

    // Không đoạn mã nào chạy.
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    expect(dialogs).toEqual([]);
  });

  test('thẻ sự kiện ở trang danh sách cũng hiện tiêu đề thành chữ', async ({ page }) => {
    await page.goto('/events?q=XSS');
    await expect(page.locator('main a[href="/events/xss-check"] h3')).toHaveText(FIXTURE.xss.title);
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  });
});
