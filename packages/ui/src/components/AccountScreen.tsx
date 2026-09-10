import type { ReactNode } from 'react';
import { cx } from '../cx';
import styles from './account.module.css';

export interface AccountScreenProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Khung màn tài khoản, dùng chung cho cả bốn app.
 *
 * Trước đây màn này ở app khách mượn stylesheet của trang điều khoản — chạy được, nhưng mọi lần
 * chỉnh trang điều khoản là màn tài khoản đổi theo mà không ai ngờ tới. Có khung riêng thì hai
 * thứ không liên quan nữa thôi kéo nhau.
 */
export function AccountScreen({ title, description, children, className }: AccountScreenProps) {
  return (
    <main className={cx(styles.page, className)}>
      <header className={styles.pageHead}>
        <h1 className={styles.pageTitle}>{title}</h1>
        {description ? <p className={styles.pageDescription}>{description}</p> : null}
      </header>
      <div className={styles.pageBody}>{children}</div>
    </main>
  );
}

export interface AccountSectionProps {
  title: string;
  children: ReactNode;
}

/** Một nhóm trong màn tài khoản: tiêu đề nhỏ + nội dung. */
export function AccountSection({ title, children }: AccountSectionProps) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}
