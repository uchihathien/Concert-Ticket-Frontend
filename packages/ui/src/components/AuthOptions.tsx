import type { ReactNode } from 'react';
import styles from './signin.module.css';

export interface AuthOptionsProps {
  /**
   * Đăng nhập qua nhà cung cấp ngoài — hiện là Google, đặt TRÊN đường mật khẩu.
   *
   * Thứ tự này là có chủ ý: phần lớn người dùng đã đăng nhập Google sẵn trên máy, nên đặt nó
   * trước giúp họ xong trong một cú bấm. Ai không dùng Google vẫn thấy đường quen thuộc ngay bên
   * dưới, không phải tìm.
   *
   * Bỏ trống thì cả khối phân cách cũng biến mất — ba app nội bộ không có đăng nhập mạng xã hội.
   */
  social?: ReactNode;
  /** Nhãn giữa đường kẻ phân cách. */
  dividerLabel?: string;
  /** Đường đăng nhập chính (email/mật khẩu qua Keycloak). */
  primary: ReactNode;
  /**
   * Đường tới màn hình "quên mật khẩu" của Keycloak.
   *
   * Là `href` chứ không phải hành động: đây là một liên kết rời khỏi app, sang tên miền của IdP.
   * Dựng nó thành nút gọi Server Action sẽ giấu mất đích đến khỏi thanh trạng thái của trình
   * duyệt — đúng thứ người dùng cần thấy trước khi gõ mật khẩu ở đâu đó.
   *
   * Bỏ trống thì cả dòng biến mất: `resetPasswordUrlFromEnv` trả `null` khi thiếu cấu hình, và
   * thiếu một liên kết phụ không đáng làm trắng trang đăng nhập.
   */
  forgotPasswordHref?: string | null;
  /** Hành động phụ — ở app khách là "Tạo tài khoản mới". */
  secondary?: ReactNode;
  /** Dòng chú thích cuối khối. */
  note?: ReactNode;
}

/**
 * Khối lựa chọn đăng nhập: Google → phân cách → email → đăng ký → chú thích.
 *
 * Tồn tại để **trang `/login` và modal ở header vẽ ra đúng một thứ**. Trước đây modal tự dựng lại
 * ba cái nút cho giống trang login; mọi lần chỉnh `Button` hay `signin.module.css` là hai bên lệch
 * nhau mà không ai phát hiện — hai màn này người dùng hiếm khi thấy cạnh nhau.
 *
 * Nhận các nút dưới dạng slot chứ không tự dựng: trang login submit `<form>` bằng Server Action
 * (chạy được cả khi chưa có JavaScript), còn modal bấm nút mở popup. Hành vi khác nhau, hình
 * dạng thì không được phép khác.
 */
export function AuthOptions({
  social,
  dividerLabel = 'hoặc',
  primary,
  forgotPasswordHref,
  secondary,
  note,
}: AuthOptionsProps) {
  return (
    <>
      {social ? (
        <>
          {social}
          <div className={styles.divider}>
            <span>{dividerLabel}</span>
          </div>
        </>
      ) : null}

      <div className={styles.actions}>
        {primary}
        {forgotPasswordHref ? (
          <p className={styles.forgot}>
            <a className={styles.forgotLink} href={forgotPasswordHref}>
              Quên mật khẩu?
            </a>
          </p>
        ) : null}
        {secondary}
      </div>

      {note ? <p className={styles.footer}>{note}</p> : null}
    </>
  );
}
