import { safeReturnUrl } from '@nexaticket/auth';
import { BrandLogo, Button, SignInScreen } from '@nexaticket/ui';
import { startRegister, startSignIn } from '@/app/actions/auth';

/**
 * C-LOGIN — trang thật, không phải bản dự phòng của modal.
 *
 * Modal ở header là lớp tiện lợi cho người đang duyệt; trang này mới là đích của middleware khi
 * chặn một đường dẫn cần đăng nhập, và là chỗ hoạt động khi JavaScript chưa chạy.
 *
 * `returnUrl` đến từ query string nên phải lọc qua `safeReturnUrl` trước khi dùng, nếu không đây
 * là một open redirect.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = typeof params.returnUrl === 'string' ? params.returnUrl : null;
  const returnUrl = safeReturnUrl(raw, '/');

  return (
    <SignInScreen
      brand={<BrandLogo height={36} priority />}
      title="Đăng nhập để mua vé"
      description="Giữ chỗ, thanh toán và xem vé của bạn ở một tài khoản duy nhất."
      action={startSignIn}
      buttonLabel="Đăng nhập"
      hiddenFields={<input type="hidden" name="returnUrl" value={returnUrl} />}
      secondary={
        <form action={startRegister}>
          <input type="hidden" name="returnUrl" value={returnUrl} />
          <Button type="submit" size="lg" block variant="secondary">
            Tạo tài khoản mới
          </Button>
        </form>
      }
      footer="Bạn sẽ nhập mật khẩu trên trang đăng nhập của NexaTicket, rồi quay lại đúng chỗ đang xem."
    />
  );
}
