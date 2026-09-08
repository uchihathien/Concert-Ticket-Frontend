import type { ReactNode } from 'react';
import { BottomNav } from '@/components/BottomNav';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import styles from '@/components/site.module.css';

/**
 * Khung chung của các trang công khai: trang chủ, danh sách, chi tiết, hỗ trợ, điều khoản.
 *
 * `/login` và các route handler nằm ngoài nhóm này — màn đăng nhập không có header lẫn bottom nav
 * để không mời người dùng đi chỗ khác giữa chừng.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <div className={styles.content}>{children}</div>
      <SiteFooter />
      <BottomNav />
    </>
  );
}
