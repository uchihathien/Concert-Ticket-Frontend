import Link from 'next/link';
import type { ReactNode } from 'react';
import { SavedCount } from './SavedEventsList';
import styles from './account-links.module.css';

/** Lối tắt ở trang Tài khoản — cùng bốn mục với tab Tài khoản của app điện thoại. */
export function AccountLinks() {
  return (
    <nav className={styles.list} aria-label="Lối tắt tài khoản">
      <Row href="/me/orders" icon="🧾" title="Đơn hàng của tôi" detail="Đơn đã thanh toán và đang chờ" />
      <Row href="/me/tickets" icon="🎫" title="Vé của tôi" detail="Mã vào cửa của từng vé" />
      <Row href="/me/saved" icon="🔖" title="Sự kiện đã lưu" detail={<SavedCount />} />
      <Row href="/support" icon="💬" title="Trợ giúp & hỗ trợ" detail="Câu hỏi thường gặp, chat hỗ trợ" />
    </nav>
  );
}

function Row({ href, icon, title, detail }: { href: string; icon: string; title: string; detail: ReactNode }) {
  return (
    <Link href={href} className={styles.row}>
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        <span className={styles.detail}>{detail}</span>
      </span>
      <span className={styles.chevron} aria-hidden="true">
        ›
      </span>
    </Link>
  );
}
