/** @type {import('next').NextConfig} */
const nextConfig = {
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
};

export default nextConfig;
