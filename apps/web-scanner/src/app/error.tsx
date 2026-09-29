'use client';

import { Button, ErrorState } from '@nexaticket/ui';
import Link from 'next/link';

/**
 * Lỗi không bắt được trong app soát vé.
 *
 * <h3>Vì sao app này cần ranh giới lỗi hơn cả ba app kia</h3>
 *
 * Nó chạy trên điện thoại của nhân viên, ở cửa soát vé, với một hàng người đang đứng chờ. Một
 * trang trắng ở đây không phải chuyện "người dùng thử lại sau" — nó là hàng dừng lại. Và đây từng
 * là app duy nhất không có `error.tsx` lẫn `not-found.tsx`.
 *
 * <h3>Vì sao lối thoát là trang quét, không phải trang chủ</h3>
 *
 * Người đang dùng máy chỉ có đúng một việc. Đưa họ về trang chủ là bắt bấm thêm một lần nữa giữa
 * lúc bận nhất.
 */
export default function ScannerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main style={{ padding: 'var(--nt-space-6) var(--nt-space-4)' }}>
      <ErrorState
        error={null}
        correlationId={error.digest ?? null}
        onRetry={reset}
        action={
          <Link href="/scan">
            <Button variant="ghost">Về màn hình quét</Button>
          </Link>
        }
      />
    </main>
  );
}
