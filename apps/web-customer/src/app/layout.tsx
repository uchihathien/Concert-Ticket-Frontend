import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import '@nexaticket/tokens/tokens.css';
import '@nexaticket/tokens/reset.css';
// Sau reset: tiện ích của Tailwind phải thắng được nền của reset khi hai bên cùng nhắm một thứ.
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
