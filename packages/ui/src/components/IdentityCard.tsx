import type { ReactNode } from 'react';
import { cx } from '../cx';
import styles from './account.module.css';

export interface IdentityCardProps {
  /** Tên hiển thị. Thiếu thì rơi về phần trước `@` của email. */
  name?: string | null;
  email?: string | null;
  /** Ảnh đại diện do IdP trả về (Google có, đăng nhập mật khẩu thường không). */
  imageUrl?: string | null;
  /** Huy hiệu phụ: cách đăng nhập, vai trò, tổ chức… */
  meta?: ReactNode;
  className?: string;
}

/**
 * Thẻ "bạn đang là ai".
 *
 * Dùng chung cho cả bốn app để người dùng chuyển qua lại vẫn nhận ra ngay danh tính của mình.
 *
 * Không có ô sửa: tên, ảnh và mật khẩu do Keycloak giữ, và chưa có endpoint nào qua gateway để
 * ghi lại. Dựng form rồi không lưu được đi đâu thì tệ hơn là chưa có.
 */
export function IdentityCard({ name, email, imageUrl, meta, className }: IdentityCardProps) {
  const displayName = name?.trim() || email?.split('@')[0] || 'Tài khoản';
  const initial = displayName.charAt(0);

  return (
    <div className={cx(styles.identity, className)}>
      {imageUrl ? (
        // Ảnh từ tên miền của IdP, cố ý không đi qua `next/image`: thêm một host vào
        // `images.remotePatterns` chỉ để hiện một avatar 56px là đổi cấu hình triển khai lấy một
        // thứ không đáng. `alt` rỗng vì tên nằm ngay bên cạnh.
        <img className={styles.avatar} src={imageUrl} alt="" width={56} height={56} />
      ) : (
        <span className={styles.initial} aria-hidden="true">
          {initial}
        </span>
      )}

      <div className={styles.identityBody}>
        <p className={styles.identityName}>{displayName}</p>
        {email ? <p className={styles.identityEmail}>{email}</p> : null}
        {meta ? <div className={styles.identityMeta}>{meta}</div> : null}
      </div>
    </div>
  );
}

export interface DetailRow {
  label: string;
  value: ReactNode;
  /** Giá trị kỹ thuật (id, mã tra cứu) — hiện bằng chữ đều để đọc và đối chiếu dễ hơn. */
  mono?: boolean;
}

export interface DetailRowsProps {
  rows: DetailRow[];
  className?: string;
}

/** Danh sách nhãn — giá trị, dùng cho phần chi tiết phiên đăng nhập. */
export function DetailRows({ rows, className }: DetailRowsProps) {
  return (
    <dl className={cx(styles.rows, className)}>
      {rows.map((row) => (
        <div className={styles.row} key={row.label}>
          <dt className={styles.rowLabel}>{row.label}</dt>
          <dd className={cx(styles.rowValue, row.mono && styles.rowValueMono)}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
