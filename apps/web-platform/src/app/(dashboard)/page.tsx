import { redirect } from 'next/navigation';

/**
 * Cửa vào khu quản trị nền tảng dẫn thẳng tới danh sách tổ chức.
 *
 * Trước đây danh sách nằm ngay ở `/`. Nó dời sang `/organizations` để màn chi tiết có chỗ ở
 * (`/organizations/{id}`) và để mục "Tổ chức" ở cột điều hướng sáng đúng khi đang xem một tổ chức —
 * `AppShell` so khớp theo tiền tố, mà `/` thì phải khớp tuyệt đối, nếu không mục đầu tiên sáng ở
 * mọi trang.
 */
export default function PlatformHomePage() {
  redirect('/organizations');
}
