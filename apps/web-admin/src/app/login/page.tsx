import { safeReturnUrl } from '@nexaticket/auth';
import { BrandLogo, SignInScreen } from '@nexaticket/ui';
import { signIn } from '@/auth';

/**
 * C-LOGIN — chỉ một nút dẫn sang Keycloak.
 *
 * `returnUrl` do middleware gắn vào khi chặn một đường dẫn cần đăng nhập. Nó đến từ query
 * string nên phải lọc qua `safeReturnUrl` trước khi dùng, nếu không đây là một open redirect.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = typeof params.returnUrl === 'string' ? params.returnUrl : null;
  const redirectTo = safeReturnUrl(raw, '/');

  async function signInWithKeycloak() {
    'use server';
    await signIn('keycloak', { redirectTo });
  }

  return (
    <SignInScreen
      brand={
        <>
          <BrandLogo height={34} priority />
          <span>· Tổ chức</span>
        </>
      }
      title="Đăng nhập để quản lý sự kiện"
      description="Khu vực dành cho ban tổ chức: sự kiện, sơ đồ chỗ, thành viên."
      action={signInWithKeycloak}
      buttonLabel="Đăng nhập"
      footer="Tài khoản từ cấp quản trị tổ chức trở lên bắt buộc xác thực hai bước, ép ở phía Keycloak."
    />
  );
}
