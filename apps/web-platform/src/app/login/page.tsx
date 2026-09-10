import { resetPasswordUrlFromEnv, safeReturnUrl } from '@nexaticket/auth';
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
      forgotPasswordHref={resetPasswordUrlFromEnv('web-platform')}
      brand={
        <>
          <BrandLogo height={34} priority />
          <span>· Nền tảng</span>
        </>
      }
      title="Khu vực quản trị nền tảng"
      description="Tổ chức, địa điểm dùng chung, sổ cái và chi trả."
      action={signInWithKeycloak}
      buttonLabel="Đăng nhập"
      footer="Chỉ superadmin. Bắt buộc xác thực hai bước."
    />
  );
}
