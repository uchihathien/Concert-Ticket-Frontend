import { safeReturnUrl } from '@nexaticket/auth';
import { BrandLogo, Button, GoogleButton, SignInHighlights, SignInScreen } from '@nexaticket/ui';
import { startGoogleSignIn, startRegister, startSignIn } from '@/app/actions/auth';
import { googleSignInEnabled } from '@/lib/auth-providers';

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
  const hidden = <input type="hidden" name="returnUrl" value={returnUrl} />;

  return (
    <SignInScreen
      brand={<BrandLogo height={36} priority />}
      title="Đăng nhập để mua vé"
      description="Giữ chỗ, thanh toán và xem vé của bạn ở một tài khoản duy nhất."
      aside={
        <SignInHighlights
          title="Vé của bạn, gọn trong một tài khoản"
          items={[
            'Giữ chỗ trong lúc thanh toán, không lo mất ghế đã chọn',
            'Vé điện tử luôn sẵn trong máy, quét thẳng ở cửa vào',
            'Xem lại lịch sử mua và hoá đơn bất cứ lúc nào',
          ]}
        />
      }
      social={
        googleSignInEnabled() ? (
          <form action={startGoogleSignIn}>
            {hidden}
            <GoogleButton />
          </form>
        ) : null
      }
      action={startSignIn}
      buttonLabel="Đăng nhập bằng email"
      hiddenFields={hidden}
      secondary={
        <form action={startRegister}>
          {hidden}
          <Button type="submit" size="lg" block variant="secondary">
            Tạo tài khoản mới
          </Button>
        </form>
      }
      footer="Bạn sẽ nhập mật khẩu trên trang đăng nhập của NexaTicket, rồi quay lại đúng chỗ đang xem."
    />
  );
}
