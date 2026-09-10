'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cx } from '../cx';
import styles from './shell.module.css';

export interface AppNavItem {
  href: string;
  label: string;
}

export interface AppShellProps {
  /** Khối thương hiệu ở đầu cột — thường là `<BrandLogo />` kèm tên khu vực. */
  brand: ReactNode;
  nav: AppNavItem[];
  /** Cuối cột điều hướng: lối vào màn tài khoản và đăng xuất. */
  foot?: ReactNode;
  children: ReactNode;
}

/**
 * Khung của hai app quản trị.
 *
 * `web-admin` và `web-platform` phục vụ hai persona khác nhau nhưng cùng một kiểu làm việc —
 * nhiều bảng, ít đồ hoạ, chuyển qua lại giữa vài khu vực. Dùng chung khung để người vừa làm ở
 * app này sang app kia không phải học lại chỗ nào bấm.
 *
 * `web-scanner` cố ý KHÔNG dùng: nó là một công cụ một việc, chạy một tay ngoài trời, và một cột
 * điều hướng ở đó chỉ là chỗ để bấm nhầm.
 */
export function AppShell({ brand, nav, foot, children }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/">
          {brand}
        </Link>

        <nav className={styles.nav} aria-label="Khu vực">
          {nav.map((item) => {
            // So khớp theo tiền tố để trang con vẫn sáng đúng mục cha, nhưng `/` phải khớp tuyệt
            // đối — nếu không thì mục đầu tiên sáng ở mọi trang.
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cx(styles.navItem, active && styles.navItemActive)}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {foot ? <div className={styles.sidebarFoot}>{foot}</div> : null}
      </aside>

      <main className={styles.content}>{children}</main>
    </div>
  );
}

/**
 * Chữ phụ cạnh logo trong cột điều hướng, ví dụ "Nền tảng", "Tổ chức".
 *
 * Là component chứ không phải để app tự đặt class: class nằm trong CSS Module của `packages/ui`,
 * app không với tới được tên đã băm.
 */
export function BrandSuffix({ children }: { children: ReactNode }) {
  return <span className={styles.brandSuffix}>{children}</span>;
}

export interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  /** Hành động chính của trang, ví dụ "Tạo sự kiện". */
  actions?: ReactNode;
}

/** Đầu trang trong khung quản trị: tiêu đề, mô tả, và hành động chính nằm bên phải. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className={styles.pageHead}>
      <div>
        <h1 className={styles.pageTitle}>{title}</h1>
        {description ? <p className={styles.pageDescription}>{description}</p> : null}
      </div>
      {actions}
    </header>
  );
}

/** Khối nội dung trên nền xám của khung quản trị. */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(styles.panel, className)}>{children}</div>;
}
