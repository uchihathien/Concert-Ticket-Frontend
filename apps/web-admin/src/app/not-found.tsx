import { Button, EmptyState } from '@nexaticket/ui';
import Link from 'next/link';

/**
 * 404.
 *
 * Cố ý KHÔNG nằm trong nhóm `(dashboard)`: một đường dẫn không tồn tại thì không có mục nào trên
 * cột điều hướng ứng với nó, và một cái khung với cả bốn mục đều tắt đọc như thể app bị hỏng.
 * Ở đây chỉ cần một câu và một đường về.
 */
export default function NotFound() {
  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ maxWidth: 480 }}>
        <EmptyState
          title="Không có trang này"
          description="Đường dẫn bạn mở không tồn tại, hoặc đã được đổi tên."
          action={
            <Link href="/">
              <Button>Về danh sách sự kiện</Button>
            </Link>
          }
        />
      </div>
    </main>
  );
}
