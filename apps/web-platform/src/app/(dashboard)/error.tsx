'use client';

import { Button, ErrorState, PageHeader } from '@nexaticket/ui';
import Link from 'next/link';

/**
 * Lỗi không bắt được trong khu quản trị nền tảng.
 *
 * Phải là client component — React cần một biên lỗi thật, và biên lỗi thì chạy ở client.
 *
 * <h3>`digest` là thứ nối màn hình này với log phía server</h3>
 *
 * Next **cố ý** không gửi thông điệp lỗi thật của server sang trình duyệt ở production: một stack
 * trace lộ ra là lộ cấu trúc nội bộ. Thứ nó gửi là `digest` — một mã băm cũng xuất hiện trong log
 * của server. Nên nó đứng đúng chỗ của `correlationId` ở đây: người dùng đọc mã đó cho tổng đài,
 * và người vận hành `grep` ra đúng dòng log.
 *
 * `reset()` dựng lại đúng nhánh cây bị lỗi, không tải lại cả trang: cột điều hướng, phiên đăng
 * nhập và cache của TanStack Query đều còn nguyên.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <>
      <PageHeader title="Không tải được nội dung" />
      <ErrorState
        // `error` ở đây là `Error` của React, không phải `ApiError` của SDK — nó không có `code`
        // nên `ErrorState` dùng câu chữ mặc định, và đó là đúng: bịa ra một mã lỗi hệ thống không
        // hề trả về sẽ khiến người đọc đi tra một thứ không tồn tại.
        error={null}
        correlationId={error.digest ?? null}
        onRetry={reset}
        action={
          <Link href="/organizations">
            <Button variant="ghost">Về danh sách tổ chức</Button>
          </Link>
        }
      />
    </>
  );
}
