'use client';

import { EmptyState, Button } from '@nexaticket/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Scanner } from '@/components/Scanner';

/**
 * S-SCAN — màn quét.
 *
 * Suất diễn nằm trên URL chứ không trong state: nhân viên lỡ tải lại trang giữa ca vẫn quay đúng
 * về suất đang trực, và ca sau chỉ cần đổi một tham số.
 */
export default function ScanPage() {
  return (
    <Suspense fallback={null}>
      <ScanScreen />
    </Suspense>
  );
}

function ScanScreen() {
  const session = useSearchParams().get('session');

  if (!session) {
    return (
      <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <EmptyState
          title="Chưa chọn suất diễn"
          description="Quay lại để nhập mã suất bạn đang trực."
          action={
            <Link href="/">
              <Button>Chọn suất</Button>
            </Link>
          }
        />
      </main>
    );
  }

  return <Scanner eventSessionId={session} />;
}
