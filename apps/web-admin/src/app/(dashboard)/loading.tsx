import { PageSkeleton } from '@nexaticket/ui';

/**
 * Khung chờ dùng chung cho mọi màn của khu quản trị tổ chức.
 *
 * Đặt ở tầng nhóm route: `loading.tsx` gần nhất trên đường dẫn bọc Suspense cho mọi segment con,
 * nên một file ở đây phủ hết `/events`, `/members`, `/venues`, `/sales`, `/audit`, `/account`.
 *
 * Cột điều hướng thuộc `layout.tsx` nên nó không nằm trong khối chờ — Next giữ layout nguyên vẹn
 * khi chuyển trang, và người dùng vẫn bấm sang khu khác được trong lúc trang này đang tải.
 */
export default function DashboardLoading() {
  return <PageSkeleton rows={8} />;
}
