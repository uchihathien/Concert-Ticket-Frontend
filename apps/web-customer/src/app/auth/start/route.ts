import { IDP_GOOGLE, REGISTER_PROVIDER_ID, idpHint, safeReturnUrl } from '@nexaticket/auth';
import { signIn } from '@/auth';

/**
 * Điểm bắt đầu của luồng OIDC.
 *
 * Popup điều hướng tới đây, Auth.js dựng authorization request (Authorization Code + PKCE) rồi
 * đẩy sang Keycloak. Người dùng nhập mật khẩu trên tên miền của Keycloak — thanh địa chỉ vẫn
 * hiện, nên họ nhìn được mình đang đưa mật khẩu cho ai. Sau callback, Auth.js đặt cookie phiên
 * rồi trả về đích ghi ở `redirectTo`.
 *
 * Có route riêng thay vì mở thẳng `/api/auth/signin/...` vì đường đó cần POST kèm CSRF token,
 * còn popup thì chỉ điều hướng được bằng GET.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  // Đường này là GET và cố ý không có CSRF token — popup chỉ điều hướng được bằng GET. Cái giá
  // là bất kỳ trang nào cũng đẩy được trình duyệt của khách vào luồng đăng nhập (login CSRF):
  // kẻ tấn công dụ khách đăng nhập vào TÀI KHOẢN CỦA HẮN, rồi những gì khách thao tác sau đó —
  // vé đã mua, thẻ đã lưu — nằm trong tài khoản hắn đọc được.
  //
  // `Sec-Fetch-Site` do trình duyệt đặt và JS không sửa được, nên nó đủ để chặn. Trình duyệt cũ
  // không gửi header này; khi đó bỏ qua kiểm tra thay vì chặn, vì chặn nghĩa là không đăng nhập
  // được.
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') {
    return new Response(null, { status: 303, headers: { Location: '/login' } });
  }

  const params = new URL(request.url).searchParams;

  // Không bao giờ chuyển thẳng tham số của người dùng vào `signIn`: chỉ nhận đúng ba giá trị
  // đã biết trước, mọi thứ khác rơi về đăng nhập thường.
  const mode = params.get('mode');
  const provider = mode === 'register' ? REGISTER_PROVIDER_ID : 'keycloak';

  // `google` dùng chung client và callback với đăng nhập thường; khác biệt duy nhất là tham số
  // gợi ý IdP, và nó phải là đối số THỨ BA của `signIn` mới có tác dụng.
  const authorizationParams = mode === 'google' ? idpHint(IDP_GOOGLE) : undefined;

  // Có `returnTo` nghĩa là đang chạy trên cả trang (popup bị chặn) — về đúng chỗ người dùng đứng.
  // Không có thì đang ở trong popup, hạ cánh xuống trang báo hiệu rồi tự đóng.
  const returnTo = params.get('returnTo');
  const redirectTo = returnTo ? safeReturnUrl(returnTo, '/') : '/auth/popup-done';

  await signIn(provider, { redirectTo }, authorizationParams);

  // `signIn` kết thúc bằng một redirect (ném ra NEXT_REDIRECT), nên dòng này không chạy tới.
  return new Response(null, { status: 302, headers: { Location: '/login' } });
}
