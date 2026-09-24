import type { Metadata } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import '@nexaticket/tokens/tokens.css';
// Nền sáng + primary indigo cho khu quản trị. Phải nằm SAU `tokens.css`, nhưng cũng không phụ
// thuộc thứ tự này để đúng: selector của nó là `:root[data-app='admin']` nên specificity đã cao
// hơn `:root` trần của bộ token gốc.
import '@nexaticket/tokens/admin.css';
import '@nexaticket/tokens/reset.css';
import './tailwind.css';

/**
 * `--nt-font` khai `'Be Vietnam Pro'` từ đầu nhưng **chưa app nào tải font đó** — không
 * `next/font`, không `<link>`, không `@font-face`. Cả bốn app đang chạy bằng `system-ui`, tức là
 * nhận diện chữ chưa từng tồn tại.
 *
 * `next/font` tải lúc build và tự host, nên không có request nào sang Google lúc chạy: bớt một
 * vòng DNS + TLS trên đường tới first paint, và không lộ IP người dùng cho bên thứ ba.
 *
 * `display: 'swap'` + `adjustFontFallback` (bật sẵn) là phần chống CLS: chữ hiện ngay bằng font hệ
 * thống đã được co giãn cho khớp metric, nên lúc font thật về thì không có cú nhảy dòng nào.
 */
const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  // Bốn nét đúng bằng những nét `packages/ui` thật sự dùng (400 body, 500 nav, 600 nhãn/nút,
  // 700 tiêu đề). Thêm nét không dùng là thêm file tải về mà không ai thấy.
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-be-vietnam-pro',
});

export const metadata: Metadata = {
  title: 'NexaTicket — Quản lý tổ chức',
  description: 'Quản lý tổ chức',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // `data-app` là thứ chọn bộ token sáng ở `admin.css`. Cùng cơ chế mà web-scanner đang dùng để
    // giữ biến thể riêng của nó.
    <html lang="vi" data-app="admin" className={beVietnamPro.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
