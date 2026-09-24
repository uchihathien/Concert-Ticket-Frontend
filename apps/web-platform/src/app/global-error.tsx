'use client';

import { Button, EmptyState } from '@nexaticket/ui';
import '@nexaticket/tokens/tokens.css';
import '@nexaticket/tokens/admin.css';
import '@nexaticket/tokens/reset.css';

/**
 * Lỗi ở tầng cao nhất: chính `layout.tsx` gốc đổ.
 *
 * File này **thay thế** root layout, nên nó phải tự dựng `<html>` và `<body>` và tự nạp CSS —
 * không có gì từ layout gốc còn hiệu lực ở đây, kể cả font của `next/font` (đó là lý do
 * `--nt-font` trong `admin.css` phải có giá trị dự phòng ngay trong `var()`).
 *
 * Cũng vì thế nó cố ý KHÔNG dựng khung quản trị: khi lỗi nằm ở tầng này thì cột điều hướng chưa
 * chắc dựng được, và một cái khung vỡ còn khó hiểu hơn một trang trắng có một câu giải thích.
 *
 * `Đây là lưới an toàn cuối cùng của web-platform — mọi lỗi khác đã bị `(dashboard)/error.tsx` bắt.`
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="vi" data-app="platform">
      <body>
        <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}>
          <div style={{ maxWidth: 480 }}>
            <EmptyState
              title="Hệ thống gặp sự cố"
              description={
                error.digest
                  ? `Đọc mã tra cứu này cho bộ phận kỹ thuật: ${error.digest}`
                  : 'Thử tải lại trang. Nếu vẫn vậy, báo cho bộ phận kỹ thuật.'
              }
              action={<Button onClick={reset}>Tải lại</Button>}
            />
          </div>
        </main>
      </body>
    </html>
  );
}
