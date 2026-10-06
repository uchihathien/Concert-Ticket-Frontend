'use client';

import { EVENT_CATEGORIES } from '@nexaticket/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './site.module.css';

/**
 * Hàng danh mục dưới header.
 *
 * Ẩn ở trang chủ: ngay dưới hero ở đó đã có dải chip thể loại với đúng các mục này. Hai hàng danh
 * mục giống hệt nhau trong cùng một màn hình đầu đọc như lỗi lặp, và đẩy hero xuống thêm một
 * hàng. Ở mọi trang khác hàng này vẫn là lối tắt duy nhất sang danh sách theo thể loại.
 */
export function CategoryBar() {
  const pathname = usePathname();
  if (pathname === '/') return null;

  return (
    <nav className={styles.categoryBar} aria-label="Danh mục sự kiện">
      <Link href="/events">Tất cả</Link>
      {EVENT_CATEGORIES.map((category) => (
        <Link key={category.value} href={`/events?category=${category.value}`}>
          {category.label}
        </Link>
      ))}
    </nav>
  );
}
