import { PageSkeleton } from '@nexaticket/ui';

/**
 * Màn chi tiết tổ chức không có ô thống kê nhưng có thanh lọc thành viên, nên khung chờ của nó
 * khác khung chung ở tầng nhóm — và khác hình dạng thì phải khác file, nếu không khối chờ nhường
 * chỗ sai và trang nhảy một nhịp ngay lúc dữ liệu về.
 */
export default function OrganizationDetailLoading() {
  return <PageSkeleton filters rows={6} />;
}
