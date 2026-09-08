import { REGISTER_PROVIDER_ID, safeReturnUrl } from '@nexaticket/auth';
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
  const params = new URL(request.url).searchParams;

  // Không bao giờ chuyển thẳng tham số của người dùng vào `signIn`: chỉ nhận đúng hai giá trị.
  const provider = params.get('mode') === 'register' ? REGISTER_PROVIDER_ID : 'keycloak';

  // Có `returnTo` nghĩa là đang chạy trên cả trang (popup bị chặn) — về đúng chỗ người dùng đứng.
  // Không có thì đang ở trong popup, hạ cánh xuống trang báo hiệu rồi tự đóng.
  const returnTo = params.get('returnTo');
  const redirectTo = returnTo ? safeReturnUrl(returnTo, '/') : '/auth/popup-done';

  await signIn(provider, { redirectTo });

  // `signIn` kết thúc bằng một redirect (ném ra NEXT_REDIRECT), nên dòng này không chạy tới.
  return new Response(null, { status: 302, headers: { Location: '/login' } });
}
