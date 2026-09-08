import type { ButtonHTMLAttributes, Ref } from 'react';
import { cx } from '../cx';
import styles from './signin.module.css';

export interface GoogleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Mặc định "Tiếp tục với Google" — dùng chung được cho cả đăng nhập lẫn đăng ký. */
  label?: string;
  block?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * Nút "Tiếp tục với Google".
 *
 * <h3>Vì sao không dùng `<Button variant="secondary">`</h3>
 *
 * Nguyên tắc thương hiệu của Google quy định khá chặt về nút này: logo G bốn màu nguyên bản,
 * không tô lại, không đổi tỉ lệ, đặt trên nền trắng (hoặc nền tối chuẩn) với viền đủ tương phản.
 * Nhét nó vào một biến thể của nút chung sẽ khiến mọi lần chỉnh nút chung đều có nguy cơ làm sai
 * quy định — nên tách riêng và khoá lại.
 *
 * Logo nhúng thẳng dạng SVG chứ không tải từ CDN của Google: một nút đăng nhập không nên phụ
 * thuộc mạng bên thứ ba để hiển thị được, và tải ảnh từ CDN của họ ngay trên trang đăng nhập là
 * gửi kèm một tín hiệu theo dõi trước cả khi người dùng bấm.
 *
 * Chữ "Tiếp tục với" thay vì "Đăng nhập bằng": cùng một nút phục vụ cả người đã có tài khoản lẫn
 * người mới — Google tự quyết định hiện màn chọn tài khoản hay màn tạo tài khoản.
 */
export function GoogleButton({
  label = 'Tiếp tục với Google',
  block = true,
  className,
  type = 'submit',
  ...rest
}: GoogleButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={cx(styles.google, block && styles.googleBlock, className)}
    >
      <GoogleMark />
      <span>{label}</span>
    </button>
  );
}

/** Logo G chính thức, bốn màu. `aria-hidden` vì nhãn chữ bên cạnh đã nói đủ. */
function GoogleMark() {
  return (
    <svg className={styles.googleMark} viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
