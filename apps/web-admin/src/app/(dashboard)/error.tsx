'use client';

import { Button, ErrorState, PageHeader } from '@nexaticket/ui';
import Link from 'next/link';

/**
 * Lỗi không bắt được trong khu quản trị tổ chức.
 *
 * `digest` là mã băm mà Next sinh ra thay cho thông điệp lỗi thật — ở production nó **không** gửi
 * stack trace sang trình duyệt, và mã này cũng có trong log của server. Nên nó đứng đúng chỗ của
 * `correlationId`: người dùng đọc cho tổng đài, người vận hành `grep` ra đúng dòng.
 *
 * `reset()` dựng lại nhánh bị lỗi thay vì tải lại cả trang, nên phiên đăng nhập và cache truy vấn
 * còn nguyên.
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
        error={null}
        correlationId={error.digest ?? null}
        onRetry={reset}
        action={
          <Link href="/">
            <Button variant="ghost">Về danh sách sự kiện</Button>
          </Link>
        }
      />
    </>
  );
}
