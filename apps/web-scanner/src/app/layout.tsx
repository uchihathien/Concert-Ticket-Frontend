import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import '@nexaticket/tokens/tokens.css';
import '@nexaticket/tokens/reset.css';
// Tông tối xanh lá + xanh chanh của app Scanner — phải nằm sau tokens.css để ghi đè.
import './scanner-theme.css';

export const metadata: Metadata = {
  title: 'NexaTicket — Soát vé',
  description: 'Soát vé',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" data-app="scanner">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
