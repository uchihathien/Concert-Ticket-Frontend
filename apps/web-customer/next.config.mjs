import path from 'node:path';

// Nhập tường minh thay vì dựa vào biến toàn cục `process`: file này là ESM và cấu hình ESLint của
// workspace không bật sẵn môi trường Node cho nó.
import process from 'node:process';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Đóng gói vào container: gom đúng những file cần chạy vào .next/standalone.
  //
  // Không có dòng này thì image phải mang cả node_modules — vài trăm MB cho một app vài MB, và
  // phần lớn là phụ thuộc chỉ dùng lúc build. Next tự tính đồ thị phụ thuộc lúc chạy và chép đúng
  // những gì cần.
  output: 'standalone',
  // BẮT BUỘC trong monorepo pnpm.
  //
  // Không có nó, Next chỉ lần dấu phụ thuộc từ thư mục app và bỏ sót các package workspace — vốn
  // là symlink tới ../../packages. Bản standalone khi đó build xong bình thường rồi chết lúc chạy
  // với `Cannot find module '@nexaticket/ui'`, tức là lỗi chỉ lộ ra trong container.
  outputFileTracingRoot: path.join(import.meta.dirname, '../../'),
  reactStrictMode: true,
  // Package trong workspace là mã nguồn TypeScript, Next phải tự biên dịch.
  transpilePackages: [
    '@nexaticket/brand',
    '@nexaticket/tokens',
    '@nexaticket/ui',
    '@nexaticket/ts-sdk',
    '@nexaticket/auth',
  ],
  // Access token KHÔNG BAO GIỜ chạm localStorage/sessionStorage (plan/frontend.md §4).
  // Session nằm ở cookie httpOnly do route handler quản lý.
  poweredByHeader: false,
  // CI chạy `pnpm lint` riêng với cấu hình flat của workspace. Next không đọc được cấu hình
  // tái xuất từ package nên báo nhầm là thiếu plugin, và lint hai lần chỉ tốn thời gian.
  eslint: { ignoreDuringBuilds: true },
  // Cho phép build ra thư mục khác `.next`.
  //
  // Lý do: `next build` và `next dev` dùng chung `.next`, nên build trong lúc dev đang chạy sẽ
  // ghi đè chunk mà dev server đang giữ — trang trắng kèm "Cannot find module './935.js'", trông
  // hệt như lỗi CSS chứ không ai đoán ra là do build. Đặt `NEXT_DIST_DIR=.next-check` để kiểm
  // tra prerender mà không đụng vào dev đang chạy.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
};

export default nextConfig;
