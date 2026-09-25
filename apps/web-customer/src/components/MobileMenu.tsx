'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { EVENT_CATEGORIES } from '@nexaticket/ui';
import styles from './site.module.css';

export interface MobileMenuProps {
  cities: string[];
  organizerUrl: string;
}

/**
 * Menu hamburger cho màn hẹp.
 *
 * Dựng trên `<dialog>` thật: bẫy focus, phím Esc và việc làm trơ phần nền đều do trình duyệt lo.
 * Một `<div>` có `position: fixed` trông giống hệt nhưng người dùng bàn phím sẽ tab ra sau lưng
 * lớp phủ mà không biết mình đang ở đâu.
 *
 * Đóng lại mỗi khi đường dẫn đổi — không có việc đó thì bấm một mục xong menu vẫn nằm che màn.
 */
export function MobileMenu({ cities, organizerUrl }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const element = dialogRef.current;
    if (!element) return;

    if (open && !element.open) {
      if (typeof element.showModal === 'function') element.showModal();
      else element.open = true;
    } else if (!open && element.open) {
      if (typeof element.close === 'function') element.close();
      else element.open = false;
    }
  }, [open]);

  useEffect(() => {
    const element = dialogRef.current;
    if (!element) return;
    const cancel = (event: Event) => {
      event.preventDefault();
      setOpen(false);
    };
    element.addEventListener('cancel', cancel);
    return () => element.removeEventListener('cancel', cancel);
  }, []);

  // Điều hướng xong thì đóng.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <button
        type="button"
        className={styles.burger}
        aria-label="Mở menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>

      <dialog ref={dialogRef} className={styles.drawer} aria-label="Menu">
        <div className={styles.drawerHead}>
          <span className={styles.drawerTitle}>Danh mục</span>
          <button
            type="button"
            className={styles.drawerClose}
            aria-label="Đóng menu"
            onClick={() => setOpen(false)}
          >
            ×
          </button>
        </div>

        <nav className={styles.drawerNav} aria-label="Danh mục sự kiện">
          {EVENT_CATEGORIES.map((category) => (
            <Link key={category.value} href={`/events?category=${category.value}`}>
              {category.label}
            </Link>
          ))}
        </nav>

        {cities.length > 0 ? (
          <>
            <p className={styles.drawerTitle}>Thành phố</p>
            <nav className={styles.drawerNav} aria-label="Thành phố">
              {cities.map((city) => (
                <Link key={city} href={`/events?city=${encodeURIComponent(city)}`}>
                  {city}
                </Link>
              ))}
            </nav>
          </>
        ) : null}

        <p className={styles.drawerTitle}>Tài khoản</p>
        <nav className={styles.drawerNav} aria-label="Tài khoản">
          <Link href="/me/tickets">Vé của tôi</Link>
          <Link href="/me/orders">Đơn hàng của tôi</Link>
          <Link href="/account">Tài khoản</Link>
          <Link href="/support">Hỗ trợ</Link>
          <a href={organizerUrl}>Tạo sự kiện</a>
        </nav>
      </dialog>
    </>
  );
}
