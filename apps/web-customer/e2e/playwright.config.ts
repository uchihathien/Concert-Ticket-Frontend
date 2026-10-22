import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * E2E của web-customer: `next dev` thật + một máy chủ giả (gateway + OIDC) — xem e2e/README.md.
 *
 * Cổng lấy động rồi GHI vào process.env: Playwright nạp file này ở cả tiến trình chính lẫn từng
 * worker, mà worker kế thừa env của tiến trình chính. Không ghi lại thì mỗi worker tự chọn một cổng
 * khác và `baseURL` của test trỏ vào hư không.
 */
function freePort(): number {
  const script =
    "const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>{console.log(s.address().port);s.close();});";
  return Number(execFileSync(process.execPath, ['-e', script]).toString().trim());
}

process.env.E2E_STUB_PORT ??= String(freePort());
process.env.E2E_WEB_PORT ??= String(freePort());
// Bí mật CHỈ cho lần chạy này, sinh ngẫu nhiên — không đọc .env.local, không dùng secret thật nào.
process.env.E2E_AUTH_SECRET ??= randomBytes(32).toString('base64url');

const STUB_PORT = process.env.E2E_STUB_PORT;
const WEB_PORT = process.env.E2E_WEB_PORT;
const STUB_URL = `http://127.0.0.1:${STUB_PORT}`;
const WEB_URL = `http://localhost:${WEB_PORT}`;
process.env.E2E_STUB_URL = STUB_URL;

const appDir = path.resolve(__dirname, '..');
// Đầu ra của Playwright nằm NGOÀI thư mục app: `next dev` theo dõi cả thư mục app, và mỗi lần
// Playwright ghi trace/báo cáo là Next biên dịch lại + nạp lại trang giữa lúc đang hydrate —
// cú bấm đến trước lúc hydrate bị nuốt, test chập chờn.
const outputRoot = path.join(os.tmpdir(), 'nexaticket-web-customer-e2e');

export default defineConfig({
  testDir: './tests',
  // Một `next dev` và một máy chủ giả có trạng thái dùng chung: chạy tuần tự. Máy này cũng không
  // đủ RAM cho nhiều trình duyệt song song cạnh một dev server.
  workers: 1,
  fullyParallel: false,
  // Lần đầu mở một route, `next dev` mới biên dịch nó — có thể mất cả chục giây.
  timeout: 120_000,
  expect: { timeout: 20_000 },
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: path.join(outputRoot, 'report') }]],
  outputDir: path.join(outputRoot, 'test-results'),
  use: {
    baseURL: WEB_URL,
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    navigationTimeout: 90_000,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      name: 'stub',
      command: `"${process.execPath}" e2e/stub-server.mjs`,
      cwd: appDir,
      url: `${STUB_URL}/__health`,
      reuseExistingServer: false,
      timeout: 30_000,
      env: { STUB_PORT, WEB_ORIGIN: WEB_URL },
    },
    {
      name: 'web-customer',
      // Gọi thẳng binary của Next thay vì qua pnpm: ít tầng tiến trình hơn, nên khi Playwright dọn
      // cây tiến trình lúc kết thúc thì không còn `next dev` nào sót lại giữ RAM.
      command: `"${process.execPath}" node_modules/next/dist/bin/next dev -p ${WEB_PORT}`,
      cwd: appDir,
      url: `${WEB_URL}/login`,
      // KHÔNG dùng lại server đang chạy: cổng 3000 có thể là dev server của người dùng, trỏ vào
      // backend thật.
      reuseExistingServer: false,
      timeout: 300_000,
      stdout: 'pipe',
      env: {
        // Thư mục build riêng: không đụng `.next` của dev server người dùng (build/dev chung một
        // thư mục là hỏng chunk — xem next.config.mjs).
        NEXT_DIST_DIR: '.next-e2e',
        NEXT_TELEMETRY_DISABLED: '1',
        AUTH_SECRET: process.env.E2E_AUTH_SECRET,
        AUTH_URL: WEB_URL,
        AUTH_TRUST_HOST: 'true',
        KEYCLOAK_ISSUER: `${STUB_URL}/realms/nexaticket`,
        KEYCLOAK_CLIENT_ID: 'web-customer',
        KEYCLOAK_CLIENT_SECRET: 'e2e-client-secret-not-real',
        // Không Redis: store phiên in-memory (chế độ dev của @nexaticket/auth).
        REDIS_URL: '',
        API_BASE_URL: STUB_URL,
        NEXT_PUBLIC_API_BASE_URL: STUB_URL,
        AUTH_GOOGLE_ENABLED: 'true',
      },
    },
  ],
});
