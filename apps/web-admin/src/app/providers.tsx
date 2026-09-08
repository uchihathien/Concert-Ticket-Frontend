'use client';

import { ToastProvider } from '@nexaticket/ui';
import { NexaQueryProvider } from '@nexaticket/ts-sdk';
import type { ReactNode } from 'react';
import { apiClient } from '@/lib/api-client';

/** Gắn ApiClient, TanStack Query và vùng thông báo một lần ở gốc cây. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <NexaQueryProvider client={apiClient}>
      <ToastProvider>{children}</ToastProvider>
    </NexaQueryProvider>
  );
}
