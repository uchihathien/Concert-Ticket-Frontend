/**
 * Tailwind v4 chạy qua plugin PostCSS riêng; không còn `tailwind.config.js`.
 *
 * Next chỉ đọc file này lúc khởi động — thêm hoặc sửa nó khi `next dev` đang chạy thì không có
 * tác dụng gì, và triệu chứng là CSS biên dịch vẫn còn nguyên chỉ thị `@tailwind`.
 */
const config = {
  plugins: ['@tailwindcss/postcss'],
};

export default config;
