import { NotFoundBody } from '@/components/NotFoundBody';

/**
 * 404 cho đường dẫn không khớp nhóm route nào (ví dụ `/linh-tinh`).
 *
 * Không có header/footer vì `(site)/layout.tsx` không bao tới đây — Next chỉ áp layout gốc. Vì
 * vậy nội dung phải tự mang đủ lối đi tiếp, và `NotFoundBody` đã có sẵn ba đường đó.
 */
export default function RootNotFound() {
  return <NotFoundBody />;
}
