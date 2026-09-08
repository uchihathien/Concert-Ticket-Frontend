'use server';

import { REGISTER_PROVIDER_ID, safeReturnUrl } from '@nexaticket/auth';
import { signIn } from '@/auth';

/**
 * Hai đường vào Keycloak, dùng chung cho modal và cho trang `/login`.
 *
 * Cả hai đều kết thúc bằng một lần chuyển hướng sang Keycloak — mật khẩu nhập trên tên miền của
 * IdP, không phải của mình. Đó là lý do modal chỉ là cửa mở chứ không chứa ô nhập: nhúng trang
 * đăng nhập của IdP vào iframe vừa bị `frame-ancestors` chặn, vừa xoá mất thứ duy nhất giúp
 * người dùng nhận ra trang thật là thanh địa chỉ.
 *
 * Nhận `FormData` chứ không nhận tham số: nhờ vậy cùng một action chạy được cho `<form>` thường
 * (không cần JavaScript) và cho form trong modal.
 */
export async function startSignIn(formData: FormData): Promise<void> {
  await signIn('keycloak', { redirectTo: readReturnUrl(formData) });
}

export async function startRegister(formData: FormData): Promise<void> {
  await signIn(REGISTER_PROVIDER_ID, { redirectTo: readReturnUrl(formData) });
}

/** `returnUrl` do trang gửi lên, gốc là query string — luôn phải lọc, nếu không là open redirect. */
function readReturnUrl(formData: FormData): string {
  const raw = formData.get('returnUrl');
  return safeReturnUrl(typeof raw === 'string' ? raw : null, '/');
}
