import { NotFoundBody } from '@/components/NotFoundBody';

/**
 * 404 cho các trang công khai.
 *
 * Nằm trong nhóm `(site)` nên nó giữ nguyên header và footer — người tới đây vẫn có thanh tìm
 * kiếm và thanh danh mục ngay trước mắt, tức là vẫn đi tiếp được mà không cần bấm Back.
 *
 * Đây là nơi `notFound()` của trang chi tiết sự kiện rơi vào khi slug không tồn tại hoặc sự kiện
 * đã bị gỡ khỏi trang bán vé.
 */
export default function SiteNotFound() {
  return <NotFoundBody />;
}
