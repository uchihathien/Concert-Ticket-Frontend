import { BrandLogo, EVENT_CATEGORIES } from '@nexaticket/ui';
import Link from 'next/link';
import { Suspense } from 'react';
import { googleSignInEnabled } from '@/lib/auth-providers';
import { AccountNav } from './AccountNav';
import { CityPicker } from './CityPicker';
import { MobileMenu } from './MobileMenu';
import { SearchBox } from './SearchBox';
import styles from './site.module.css';

export interface SiteHeaderProps {
  /** Thành phố có sự kiện đang bán — lấy từ API ở layout, không gõ tay. */
  cities: string[];
}

/**
 * Header cố định, hai tầng.
 *
 * Tầng trên: thương hiệu → ô tìm kiếm → chọn thành phố → tài khoản.
 * Tầng dưới: thanh danh mục.
 *
 * Dưới 900px, thanh danh mục và các link phụ dồn vào menu hamburger — nhồi tám mục vào một hàng
 * rộng 360px thì mục nào cũng bé hơn ngưỡng chạm 44px.
 *
 * Ba khối đọc URL (`SearchBox`, `CityPicker`, `AccountNav`) đều bọc `Suspense`: thiếu ranh giới
 * đó thì Next từ chối prerender **mọi** trang dùng layout này, kể cả trang chủ.
 */
export function SiteHeader({ cities }: SiteHeaderProps) {
  // "Tạo sự kiện" dẫn sang app của ban tổ chức — khác app, nên là link tuyệt đối.
  const organizerUrl = process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3001';

  return (
    <header className={styles.header}>
      <div className={styles.headerMain}>
        <MobileMenu cities={cities} organizerUrl={organizerUrl} />

        <Link className={styles.brand} href="/" aria-label="NexaTicket — trang chủ">
          <BrandLogo height={34} priority />
        </Link>

        <Suspense fallback={<div className={styles.search} />}>
          <SearchBox />
        </Suspense>

        {cities.length > 0 ? (
          <Suspense fallback={null}>
            <CityPicker cities={cities} />
          </Suspense>
        ) : null}

        <nav className={styles.nav}>
          <a href={organizerUrl}>Tạo sự kiện</a>
          <Link href="/me/tickets">Vé của tôi</Link>
          <Suspense
            fallback={
              <Link className={styles.login} href="/login">
                Đăng nhập
              </Link>
            }
          >
            {/* Cờ này PHẢI truyền xuống. `AccountNav` mặc định `false`, nên quên nó thì nút
                "Tiếp tục với Google" biến mất khỏi modal trong khi vẫn hiện ở trang `/login` —
                hai đường vào cùng một luồng lại khác nhau, và không có lỗi nào báo. */}
            <AccountNav googleEnabled={googleSignInEnabled()} />
          </Suspense>
        </nav>
      </div>

      <nav className={styles.categoryBar} aria-label="Danh mục sự kiện">
        <Link href="/events">Tất cả</Link>
        {EVENT_CATEGORIES.map((category) => (
          <Link key={category.value} href={`/events?category=${category.value}`}>
            {category.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
