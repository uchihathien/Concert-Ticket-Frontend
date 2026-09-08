import type { ReactNode } from 'react';
import { Button } from './Button';
import styles from './signin.module.css';

export interface SignInScreenProps {
  /**
   * Khối thương hiệu ở đầu thẻ — thường là `<BrandLogo />`, kèm tên app nếu cần.
   *
   * Nhận `ReactNode` chứ không phải chuỗi: app soát vé chạy nền tối nên phải dùng biến thể chỉ
   * biểu tượng cộng với chữ do CSS vẽ, không dùng được logo đầy đủ.
   */
  brand: ReactNode;
  title: string;
  description?: ReactNode;
  /** Server Action gọi `signIn('keycloak', …)`. */
  action: (formData: FormData) => void | Promise<void>;
  buttonLabel?: string;
  /**
   * Trường ẩn đi kèm form, ví dụ `returnUrl`.
   *
   * Là slot chứ không phải prop `returnUrl` cố định: `SignInScreen` không nên biết app dùng nó
   * cần mang theo những gì.
   */
  hiddenFields?: ReactNode;
  /**
   * Hành động phụ dưới nút chính — ở app khách là form "Tạo tài khoản mới".
   *
   * Ba app còn lại không truyền gì: tài khoản của ban tổ chức, nhân viên soát vé và superadmin
   * đều do người khác cấp, nên ở đó không tồn tại khái niệm tự đăng ký.
   */
  secondary?: ReactNode;
  /** Thông tin phụ dưới nút, ví dụ nhắc về MFA hoặc về mã truy cập của nhân viên soát vé. */
  footer?: ReactNode;
}

/**
 * Màn đăng nhập.
 *
 * Chỉ một nút dẫn sang IdP — không có ô email/mật khẩu. Mật khẩu do Keycloak giữ; dựng form đăng
 * nhập ở đây là tự rước nghĩa vụ bảo mật mà cả hệ thống đã cố ý đẩy sang IdP.
 */
export function SignInScreen({
  brand,
  title,
  description,
  action,
  buttonLabel = 'Đăng nhập',
  hiddenFields,
  secondary,
  footer,
}: SignInScreenProps) {
  return (
    <main className={styles.screen}>
      <div className={styles.card}>
        <span className={styles.brand}>{brand}</span>
        <h1 className={styles.title}>{title}</h1>
        {description ? <p className={styles.description}>{description}</p> : null}
        <form action={action}>
          {hiddenFields}
          <Button type="submit" size="lg" block>
            {buttonLabel}
          </Button>
        </form>
        {secondary}
        {footer ? <p className={styles.footer}>{footer}</p> : null}
      </div>
    </main>
  );
}
