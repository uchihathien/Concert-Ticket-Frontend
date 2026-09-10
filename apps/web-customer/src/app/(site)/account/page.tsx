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
 * C-ACCOUNT.
 *
 * Middleware đã chặn khách chưa đăng nhập trước khi tới đây, nên trang không phải tự kiểm lại.
 *
 * Chỉ hiện những gì phiên đăng nhập thật sự biết. Hồ sơ (tên, ảnh, mật khẩu) do Keycloak giữ và
 * chưa có endpoint nào qua gateway để ghi lại — dựng form sửa rồi không lưu được đi đâu thì tệ
 * hơn là chưa có.
 *
 * Cũng không hiện "đăng nhập bằng Google hay mật khẩu": với `kc_idp_hint`, cả hai đường đều về
 * cùng một provider `keycloak`, nên phiên không phân biệt được. Đoán bừa còn tệ hơn im lặng.
 */
export default async function AccountPage() {
  const session = await auth();

  async function doSignOut() {
    'use server';
    await signOut({ redirectTo: '/' });
  }

  return (
    <AccountScreen title="Tài khoản" description="Thông tin lấy từ phiên đăng nhập hiện tại.">
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
          Tên, ảnh đại diện và mật khẩu do hệ thống định danh quản lý. Màn sửa hồ sơ sẽ mở khi có
          endpoint tương ứng.
        </p>
      </AccountSection>

      <AccountSection title="Phiên đăng nhập">
        <SignOutForm action={doSignOut} />
      </AccountSection>
    </AccountScreen>
  );
}
