import { PageSkeleton } from '@nexaticket/ui';

/**
 * Khung chờ dùng chung cho mọi màn trong khu quản trị nền tảng.
 *
 * Đặt ở tầng nhóm route chứ không ở từng trang: `loading.tsx` gần nhất trên đường dẫn sẽ bọc
 * Suspense cho mọi segment con, nên một file ở đây phủ hết `/organizations`, `/ledger`,
 * `/account`. Trang nào có hình dạng khác hẳn thì tự khai một file riêng — như màn chi tiết tổ
 * chức bên dưới.
 *
 * Cột điều hướng và thanh thương hiệu KHÔNG nằm trong khối chờ này: chúng thuộc `layout.tsx`, mà
 * layout thì Next giữ nguyên khi chuyển trang. Người dùng vẫn bấm sang khu khác được trong lúc
 * trang này đang tải.
 */
export default function DashboardLoading() {
  // Năm ô thống kê + thanh bộ lọc + bảng: đúng hình dạng của `/organizations`, màn mặc định của
  // khu này.
  return <PageSkeleton stats={5} filters rows={8} />;
}
