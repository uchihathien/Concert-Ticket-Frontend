import { Button, EmptyState } from '@nexaticket/ui';
import Link from 'next/link';

/**
 * Đường dẫn không tồn tại trong app soát vé.
 *
 * App này chỉ có ba màn hình, nên tới đây gần như luôn là do gõ tay hoặc một liên kết cũ. Câu trả
 * lời đúng là đưa thẳng về màn hình quét — không có gì khác để tìm.
 */
export default function ScannerNotFound() {
  return (
    <main style={{ padding: 'var(--nt-space-6) var(--nt-space-4)' }}>
      <EmptyState
        title="Không có màn hình này"
        description="Đường dẫn không tồn tại. Máy soát vé chỉ dùng màn hình quét."
        action={
          <Link href="/scan">
            <Button>Về màn hình quét</Button>
          </Link>
        }
      />
    </main>
  );
}
