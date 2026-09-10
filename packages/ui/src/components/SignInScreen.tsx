import type { ReactNode } from 'react';
import { AuthOptions } from './AuthOptions';
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
  /**
   * Đường tới màn hình "quên mật khẩu" của Keycloak — dựng bằng `resetPasswordUrlFromEnv`.
   *
   * Trang đăng nhập của Keycloak vốn đã có sẵn nút đó, nhưng người quên mật khẩu chưa chắc đã bấm
   * "Đăng nhập" trước: họ vào trang, nhớ ra mình quên, và tìm chữ "Quên mật khẩu?" ngay tại chỗ.
   */
  forgotPasswordHref?: string | null;
  /**
   * Hành động phụ dưới nút chính — ở app khách là form "Tạo tài khoản mới".
   *
   * Ba app còn lại không truyền gì: tài khoản của ban tổ chức, nhân viên soát vé và superadmin
   * đều do người khác cấp, nên ở đó không tồn tại khái niệm tự đăng ký.
   */
  secondary?: ReactNode;
  /** Thông tin phụ dưới nút, ví dụ nhắc về MFA hoặc về mã truy cập của nhân viên soát vé. */
  footer?: ReactNode;
  /**
   * Cột giới thiệu bên cạnh thẻ, chỉ hiện trên màn hình rộng.
   *
   * Ẩn hẳn dưới 900px chứ không xếp chồng lên trên form: trên điện thoại, thứ người dùng cần là
   * nút đăng nhập nằm trong tầm ngón cái, không phải một khối quảng cáo phải cuộn qua.
   */
  aside?: ReactNode;
}

/**
 * Màn đăng nhập.
 *
 * Không có ô email/mật khẩu. Mật khẩu do Keycloak giữ; dựng form đăng nhập ở đây là tự rước nghĩa
 * vụ bảo mật mà cả hệ thống đã cố ý đẩy sang IdP — và làm người dùng mất thanh địa chỉ, thứ duy
 * nhất giúp họ phân biệt trang thật với trang giả.
 */
export function SignInScreen({
  brand,
  title,
  description,
  action,
  buttonLabel = 'Đăng nhập',
  hiddenFields,
  social,
  dividerLabel = 'hoặc',
  forgotPasswordHref,
  secondary,
  footer,
  aside,
}: SignInScreenProps) {
  return (
    <div className={aside ? styles.screenSplit : styles.screen}>
      {aside ? <aside className={styles.panel}>{aside}</aside> : null}

      <main className={styles.pane}>
        <div className={styles.card}>
          <span className={styles.brand}>{brand}</span>
          <div className={styles.heading}>
            <h1 className={styles.title}>{title}</h1>
            {description ? <p className={styles.description}>{description}</p> : null}
          </div>

          {/* Cùng khối này với modal ở header — xem `AuthOptions`. */}
          <AuthOptions
            social={social}
            dividerLabel={dividerLabel}
            primary={
              <form action={action}>
                {hiddenFields}
                <Button type="submit" size="lg" block>
                  {buttonLabel}
                </Button>
              </form>
            }
            forgotPasswordHref={forgotPasswordHref}
            secondary={secondary}
            note={footer}
          />
        </div>
      </main>
    </div>
  );
}

export interface SignInHighlightsProps {
  title: ReactNode;
  items: ReactNode[];
}

/**
 * Nội dung mặc định cho cột giới thiệu.
 *
 * Ba dòng lợi ích, không phải một đoạn văn: người đang ở màn đăng nhập không đọc, họ liếc.
 */
export function SignInHighlights({ title, items }: SignInHighlightsProps) {
  return (
    <div className={styles.panelInner}>
      <p className={styles.panelTitle}>{title}</p>
      <ul className={styles.panelList}>
        {items.map((item, index) => (
          // Danh sách tĩnh do trang khai báo, không sắp xếp lại và không thêm bớt — chỉ số làm
          // khoá là đủ và không gây lỗi tái sử dụng state.
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
