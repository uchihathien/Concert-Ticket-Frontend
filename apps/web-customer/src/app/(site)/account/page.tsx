import { Button } from '@nexaticket/ui';
import type { Metadata } from 'next';
import { auth, signOut } from '@/auth';
import styles from '../legal.module.css';

export const metadata: Metadata = {
  title: 'Tài khoản — NexaTicket',
};

/**
 * C-ACCOUNT — bản tối thiểu.
 *
 * Middleware đã chặn khách chưa đăng nhập trước khi tới đây, nên trang không phải tự kiểm lại.
 *
 * Hồ sơ (tên, số điện thoại, email liên hệ) do Keycloak quản lý và chưa có endpoint đọc/ghi qua
 * gateway, nên ở đây chỉ hiện đúng những gì phiên đăng nhập biết. Bịa thêm ô nhập rồi không lưu
 * được đi đâu thì tệ hơn là chưa có.
 */
export default async function AccountPage() {
  const session = await auth();

  async function doSignOut() {
    'use server';
    await signOut({ redirectTo: '/' });
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Tài khoản</h1>
      <p className={styles.updated}>Thông tin lấy từ phiên đăng nhập hiện tại</p>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Đăng nhập bằng</h2>
        <p>{session?.user?.email ?? session?.user?.name ?? 'Không có thông tin hiển thị'}</p>
        {session?.user?.id ? <p className={styles.updated}>ID: {session.user.id}</p> : null}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Hồ sơ</h2>
        <p>
          Tên, ảnh đại diện và mật khẩu do hệ thống định danh quản lý. Màn sửa hồ sơ sẽ mở khi có
          endpoint tương ứng.
        </p>
      </section>

      <form action={doSignOut}>
        <Button type="submit" variant="secondary">
          Đăng xuất
        </Button>
      </form>
    </main>
  );
}
