import {
  AccountScreen,
  AccountSection,
  DetailRows,
  IdentityCard,
  SignOutForm,
} from '@nexaticket/ui';
import type { Metadata } from 'next';
import { auth, signOut } from '@/auth';

export const metadata: Metadata = {
  title: 'Tài khoản — NexaTicket',
};

/**
 * Màn tài khoản.
 *
 * Tồn tại trước hết vì **đăng xuất phải có đường ra**: trước đây ba app nội bộ đăng nhập xong là
 * không có cách nào thoát, phải xoá cookie bằng tay. Dùng chung component với app khách để danh
 * tính hiện ra giống nhau ở mọi nơi.
 *
 * Middleware đã chặn người chưa đăng nhập, nên trang không phải tự kiểm lại.
 */
export default async function AccountPage() {
  const session = await auth();

  async function doSignOut() {
    'use server';
    await signOut({ redirectTo: '/login' });
  }

  return (
    <AccountScreen
      title="Tài khoản"
      description="Tài khoản ban tổ chức, lấy từ phiên đăng nhập hiện tại."
    >
      <IdentityCard
        name={session?.user?.name}
        email={session?.user?.email}
        imageUrl={session?.user?.image}
      />

      {session?.user?.id ? (
        <AccountSection title="Chi tiết">
          <DetailRows rows={[{ label: 'Mã người dùng', value: session.user.id, mono: true }]} />
        </AccountSection>
      ) : null}

      <AccountSection title="Hồ sơ">
        <p>
          Tài khoản của ban tổ chức do quản trị nền tảng cấp. Đổi tên hoặc mật khẩu thực hiện ở hệ
          thống định danh.
        </p>
      </AccountSection>

      <AccountSection title="Phiên đăng nhập">
        <SignOutForm action={doSignOut} />
      </AccountSection>
    </AccountScreen>
  );
}
