import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import '@nexaticket/tokens/tokens.css';
import '@nexaticket/tokens/reset.css';
// Sau reset: tiện ích của Tailwind phải thắng được nền của reset khi hai bên cùng nhắm một thứ.
// Tông xanh lá + xanh chanh, đồng nhất với các trang còn lại. Phải nằm SAU tokens.css.
import './customer-theme.css';
import './tailwind.css';

export const metadata: Metadata = {
  title: 'NexaTicket — Vé sự kiện',
  description: 'Vé sự kiện',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
