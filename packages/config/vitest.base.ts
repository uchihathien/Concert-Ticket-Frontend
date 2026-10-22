import { defineConfig } from 'vitest/config';

/** Cấu hình Vitest dùng chung: jsdom + globals, để test component không phải khai lại. */
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    css: true,
    restoreMocks: true,
    // Chỉ chạy khi gọi `vitest run --coverage` (script `test:coverage`); `test` thường không tốn thêm.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        // Test và khai báo kiểu không phải mã chạy.
        'src/**/__tests__/**',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        // KHÔNG loại `types/**`: floor-plan.ts, public-catalog.ts, identity.ts ở đó có hàm/hằng chạy
        // thật. File chỉ có interface thì v8 đếm 0/0, không kéo số xuống.
        // Barrel chỉ re-export; đếm nó là đếm lại chính các module đã đo.
        'src/index.ts',
      ],
    },
  },
});
