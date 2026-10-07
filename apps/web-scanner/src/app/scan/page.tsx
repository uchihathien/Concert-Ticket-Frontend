'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Scanner } from '@/components/Scanner';
import styles from '@/components/scanner.module.css';

export default function ScanPage() {
  return (
    <Suspense fallback={null}>
      <ScanScreen />
    </Suspense>
  );
}

function ScanScreen() {
  const params = useSearchParams();
  const session = params.get('session');
  const organization = params.get('org');

  // Thiếu tổ chức thì không gọi được endpoint soát theo tổ chức (kiểm quyền CHECKIN_SCAN) — như app.
  if (!session || !organization) {
    return (
      <main className={styles.center}>
        <h1 className={styles.centerTitle}>Chưa chọn suất diễn</h1>
        <p className={styles.centerCopy}>Quay lại để chọn suất bạn được giao soát vé.</p>
        <Link href="/" className={styles.actionButton}>
          CHỌN SUẤT
        </Link>
      </main>
    );
  }

  return (
    <Scanner
      eventSessionId={session}
      organizationId={organization}
      eventTitle={params.get('title') ?? ''}
      venueName={params.get('venue') ?? ''}
      startsAt={params.get('startsAt') ?? ''}
    />
  );
}
