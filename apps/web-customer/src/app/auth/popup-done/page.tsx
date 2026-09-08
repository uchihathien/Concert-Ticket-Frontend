import { PopupDone } from '@/components/PopupDone';

/**
 * Đích của popup sau khi Keycloak trả về.
 *
 * Cookie phiên đã được Auth.js đặt ở bước callback. Trang này chỉ còn việc báo cho cửa sổ cha
 * biết và tự đóng — nó không bao giờ được hiện lâu, nên nội dung cố ý tối giản.
 */
export const metadata = { title: 'Đang hoàn tất đăng nhập…' };

export default function PopupDonePage() {
  return <PopupDone />;
}
