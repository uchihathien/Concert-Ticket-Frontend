import { Button } from './Button';

export interface SignOutFormProps {
  /** Server Action gọi `signOut({ redirectTo })` của chính app đó. */
  action: (formData: FormData) => void | Promise<void>;
  label?: string;
}

/**
 * Nút đăng xuất, giống hệt nhau ở cả bốn app.
 *
 * Là `<form>` gửi POST chứ không phải link GET. Đăng xuất đổi trạng thái phía server, và một
 * đường GET có thể bị kích hoạt bởi thứ khác — trình duyệt tải trước, thẻ ảnh trên trang lạ, tiện
 * ích quét link — khiến người dùng bị đăng xuất mà không hiểu vì sao.
 *
 * Không hỏi xác nhận: đăng xuất không mất dữ liệu và đăng nhập lại chỉ mất một cú bấm. Hộp thoại
 * "bạn có chắc không" ở đây chỉ thêm một bước cho thao tác vô hại.
 */
export function SignOutForm({ action, label = 'Đăng xuất' }: SignOutFormProps) {
  return (
    <form action={action}>
      <Button type="submit" variant="secondary">
        {label}
      </Button>
    </form>
  );
}
