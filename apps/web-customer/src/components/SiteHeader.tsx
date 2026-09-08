import { BrandLogo } from '@nexaticket/ui';
import { AccountNav } from './AccountNav';
import Link from 'next/link';
import { Suspense } from 'react';
import styles from './site.module.css';

/**
 * Header ưu tiên tìm kiếm (ui-direction.md §1).
 *
 * Ô tìm kiếm là `<form method="get">` trỏ thẳng vào `/events`: tìm kiếm chạy được cả khi
 * JavaScript chưa tải xong, và kết quả nằm trên URL nên chia sẻ được.
 */
export function SiteHeader({ query = '' }: { query?: string }) {
  // "Tạo sự kiện" dẫn sang app của ban tổ chức — khác app, nên là link tuyệt đối.
  const organizerUrl = process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3001';

  return (
    <header className={styles.header}>
      <Link className={styles.brand} href="/" aria-label="NexaTicket — trang chủ">
        <BrandLogo height={38} priority />
      </Link>

      <form className={styles.search} role="search" action="/events">
        <input
          className={styles.searchInput}
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Tìm sự kiện, nghệ sĩ…"
          aria-label="Tìm sự kiện"
        />
      </form>

      <nav className={styles.nav}>
        <a href={organizerUrl}>Tạo sự kiện</a>
        <Link href="/me/tickets">Vé của tôi</Link>
        {/* AccountNav đọc search params để dựng returnUrl. Không có ranh giới Suspense thì Next
            từ chối prerender tĩnh trang chủ và các trang chữ. Fallback là chính nút đăng nhập
            dạng link thuần, nên khách thấy đúng thứ đó dù JavaScript chưa chạy. */}
        <Suspense
          fallback={
            <Link className={styles.login} href="/login">
              Đăng nhập
            </Link>
          }
        >
          <AccountNav />
        </Suspense>
      </nav>
    </header>
  );
}
