'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cx } from '../cx';
import styles from './shell.module.css';

export interface AppNavItem {
  href: string;
  label: string;
  /**
   * Biểu tượng đứng trước nhãn.
   *
   * Luôn đi KÈM chữ, không thay chữ: một cột toàn biểu tượng buộc người dùng phải đoán, và đoán
   * sai ở khu quản trị nghĩa là mở nhầm màn. Biểu tượng ở đây làm đúng một việc — cho mắt nhận ra
   * mục quen thuộc nhanh hơn là đọc.
   */
  icon?: ReactNode;
}

export interface AppShellProps {
  /** Khối thương hiệu ở đầu cột — thường là `<BrandLogo />` kèm tên khu vực. */
  brand: ReactNode;
  nav: AppNavItem[];
  /** Cuối cột điều hướng: lối vào màn tài khoản và đăng xuất. */
  /** Nhãn nhỏ phía trên danh sách điều hướng, ví dụ "Quản lý". */
  navLabel?: string;
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
export function AppShell({ brand, nav, navLabel, foot, children }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/">
          {brand}
        </Link>

        <nav className={styles.nav} aria-label="Khu vực">
          {navLabel ? <span className={styles.navLabel}>{navLabel}</span> : null}
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
                {/* `aria-hidden` vì nhãn ngay bên cạnh đã nói đủ; đọc thêm tên biểu tượng chỉ
                    làm trình đọc màn hình lặp lại chính nó. */}
                {item.icon ? (
                  <span className={styles.navIcon} aria-hidden="true">
                    {item.icon}
                  </span>
                ) : null}
                {item.label}
              </Link>
            );
          })}
        </nav>

        {foot ? <div className={styles.sidebarFoot}>{foot}</div> : null}
      </aside>

      <main className={styles.content}>
        <div className={styles.contentInner}>{children}</div>
      </main>
    </div>
  );
}

/**
 * Chữ phụ cạnh logo trong cột điều hướng, ví dụ "Nền tảng", "Tổ chức".
 *
 * Là component chứ không phải để app tự đặt class: class nằm trong CSS Module của `packages/ui`,
 * app không với tới được tên đã băm.
 */
export interface SidebarAccountProps {
  name?: string | null;
  email?: string | null;
  /** Trang tài khoản. Bấm vào khối tên là tới đây. */
  href: string;
  /** Server action đăng xuất — truyền thẳng từ layout (server component). */
  signOutAction: (formData: FormData) => void | Promise<void>;
}

/**
 * Khối người dùng ở chân sidebar: ai đang đăng nhập, đi tới trang tài khoản, đăng xuất.
 *
 * Thay cho cặp "link Tài khoản + nút Đăng xuất" rời rạc: người dùng của khu quản trị thường có
 * nhiều tài khoản (chủ tổ chức, nhân viên), và việc thấy ngay mình đang là ai là thứ chặn được
 * một thao tác nhầm tài khoản.
 */
export function SidebarAccount({ name, email, href, signOutAction }: SidebarAccountProps) {
  const display = name?.trim() || email || 'Tài khoản';
  const initials =
    display
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(-2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?';

  return (
    <div className={styles.account}>
      <Link href={href} className={styles.accountLink}>
        <span className={styles.avatar} aria-hidden="true">
          {initials}
        </span>
        <span className={styles.accountText}>
          <span className={styles.accountName}>{display}</span>
          {email && email !== display ? <span className={styles.accountEmail}>{email}</span> : null}
        </span>
      </Link>
      <form action={signOutAction}>
        <button type="submit" className={styles.signOut} aria-label="Đăng xuất" title="Đăng xuất">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="m16 17 5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
        </button>
      </form>
    </div>
  );
}

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
