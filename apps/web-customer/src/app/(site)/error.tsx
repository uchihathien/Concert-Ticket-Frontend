'use client';

import { Button, ErrorState } from '@nexaticket/ui';
import Link from 'next/link';

/**
 * Lỗi không bắt được ở bất kỳ trang nào của khu khách hàng.
 *
 * Trước file này, khu khách hàng — đúng chỗ gánh toàn bộ lưu lượng mua vé — **không có** ranh giới
 * lỗi nào, trong khi hai khu quản trị lưu lượng thấp thì có. Độ phủ đang ngược với mức rủi ro: một
 * lỗi dựng hình ở đây leo thẳng lên gốc và khách thấy một trang trắng, ngay giữa lúc họ đang trả
 * tiền.
 *
 * `digest` là mã băm Next sinh ra thay cho thông điệp lỗi thật — ở production nó **không** gửi
 * stack trace sang trình duyệt, và mã ấy cũng nằm trong log server. Nên nó đứng đúng chỗ của
 * `correlationId`: khách đọc cho tổng đài, người vận hành `grep` ra đúng dòng.
 *
 * `reset()` dựng lại nhánh hỏng chứ không tải lại cả trang, nên phiên đăng nhập và cache truy vấn
 * còn nguyên — khách không bị đá về đầu luồng đặt vé.
 */
export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main style={{ padding: 'var(--nt-space-8) var(--nt-space-4)' }}>
      <ErrorState
        error={null}
        correlationId={error.digest ?? null}
        onRetry={reset}
        action={
          <Link href="/events">
            <Button variant="ghost">Xem sự kiện khác</Button>
          </Link>
        }
      />
    </main>
  );
}
