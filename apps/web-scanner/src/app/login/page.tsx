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
          <BrandLogo variant="mark" height={34} priority />
          <span>Soát vé</span>
        </>
      }
      title="Đăng nhập để soát vé"
      description="Dùng tài khoản nhân viên của tổ chức."
      action={signInWithKeycloak}
      buttonLabel="Đăng nhập"
      footer="Đường đăng nhập bằng mã truy cập theo suất diễn chưa mở — backend chưa có endpoint phát mã."
    />
  );
}
