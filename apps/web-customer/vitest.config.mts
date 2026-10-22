import { fileURLToPath } from 'node:url';
import base from '@nexaticket/config/vitest.base.ts';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
  base,
  defineConfig({
    // Cùng bí danh `@/*` với tsconfig.json, để test import đúng như mã nguồn import.
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    // postcss.config.mjs của app khai Tailwind ở dạng chuỗi mà chỉ Next hiểu; Vite đọc nó thì hỏng.
    // Test không cần Tailwind — CSS module vẫn được xử lý với một cấu hình PostCSS rỗng.
    css: { postcss: { plugins: [] } },
    // tsconfig của app đặt `jsx: preserve` cho Next tự biên dịch; Vitest thì phải tự biến đổi JSX.
    esbuild: { jsx: 'automatic' },
    test: {
      setupFiles: ['./vitest.setup.ts'],
      // Chỉ unit test trong src/. Playwright ở e2e/ chạy bằng `pnpm test:e2e`, không qua Vitest.
      include: ['src/**/*.test.{ts,tsx}'],
    },
  }),
);
