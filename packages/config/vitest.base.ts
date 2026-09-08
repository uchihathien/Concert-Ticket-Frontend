import { defineConfig } from 'vitest/config';

/** Cấu hình Vitest dùng chung: jsdom + globals, để test component không phải khai lại. */
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    css: true,
    restoreMocks: true,
  },
});
