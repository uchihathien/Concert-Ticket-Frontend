import type { Metadata } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import '@nexaticket/tokens/tokens.css';
// Nền sáng + primary indigo cho khu quản trị. Xem ghi chú ở `web-admin/src/app/layout.tsx`.
import '@nexaticket/tokens/admin.css';
import '@nexaticket/tokens/reset.css';
import './tailwind.css';

/** Xem `web-admin/src/app/layout.tsx` để biết vì sao font phải nạp ở đây. */
const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-be-vietnam-pro',
});

export const metadata: Metadata = {
  title: 'NexaTicket — Quản trị nền tảng',
  description: 'Quản trị nền tảng',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" data-app="platform" className={beVietnamPro.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
