import type { ReactNode } from 'react';
import { BottomNav } from '@/components/BottomNav';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { SupportLauncher } from '@/components/SupportLauncher';
import styles from '@/components/site.module.css';
import { loadCities } from '@/lib/server-api';

/**
 * Khung chung của các trang công khai: trang chủ, danh sách, chi tiết, hỗ trợ, điều khoản.
 *
 * `/login` và các route handler nằm ngoài nhóm này — màn đăng nhập không có header lẫn bottom nav
 * để không mời người dùng đi chỗ khác giữa chừng.
 */

/** Khớp Cache-Control 2 phút của backend: danh sách thành phố đổi rất chậm, không cần tươi hơn. */
export const revalidate = 120;

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const cities = await loadCities();

  return (
    <>
      <SiteHeader cities={cities} />
      <div className={styles.content}>{children}</div>
      <SiteFooter />
      <BottomNav />
      {/*
        Nút chat nổi, ở MỌI trang công khai. Trước đây khung chat chỉ sống ở `/support` và đường duy
        nhất tới đó là một liên kết trong footer — nghĩa là người đang bí ở giữa luồng chọn ghế phải
        cuộn xuống hết trang rồi rời khỏi việc đang làm dở để hỏi được một câu.
      */}
      <SupportLauncher />
    </>
  );
}
