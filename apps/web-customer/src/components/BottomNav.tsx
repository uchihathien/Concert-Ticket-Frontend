'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './site.module.css';

const ITEMS = [
  { href: '/', label: 'Khám phá' },
  { href: '/me/tickets', label: 'Vé của tôi' },
  { href: '/account', label: 'Tài khoản' },
];

/**
 * Bottom nav mobile — ba việc người dùng thật sự làm (ui-direction.md §4).
 *
 * Màn chọn chỗ (C-SEATS) phải ẩn thanh này: ở đó mỗi pixel chiều cao là một hàng ghế, và một
 * thanh cố định 56px đè lên vùng chạm là nguồn bấm nhầm. Ở đó khung tóm tắt + nút "Giữ chỗ" đã
 * dính đáy, nên thanh này chỉ chồng thêm một lớp nữa lên đúng vùng khách cần bấm.
 */
export function BottomNav() {
  const pathname = usePathname();

  if (pathname.startsWith('/booking/')) return null;

  return (
    <nav className={styles.bottomNav} aria-label="Điều hướng chính">
      {ITEMS.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              active ? `${styles.bottomLink} ${styles.bottomLinkActive}` : styles.bottomLink
            }
            aria-current={active ? 'page' : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
