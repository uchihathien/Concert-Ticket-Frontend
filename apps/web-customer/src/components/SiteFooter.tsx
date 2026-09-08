import { BrandLogo } from '@nexaticket/ui';
import Link from 'next/link';
import styles from './site.module.css';

/**
 * Footer bốn cột theo quy ước của site bán vé: giới thiệu, cho khách, cho ban tổ chức, pháp lý.
 *
 * Ban tổ chức là một nhóm người dùng riêng với app riêng, nên họ có cột riêng — nhét "Tạo sự
 * kiện" lẫn vào nhóm link của khách là chôn nó.
 */
export function SiteFooter() {
  const organizerUrl = process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3001';

  return (
    <footer className={styles.footer}>
      <div className={styles.footerGrid}>
        <div className={styles.footerAbout}>
          <BrandLogo height={34} />
          <p className={styles.footerText}>
            Nền tảng bán vé sự kiện. Tiền vé được giữ hộ tới khi tới hạn đối soát với ban tổ chức.
          </p>
        </div>

        <nav className={styles.footerCol} aria-label="Dành cho khách">
          <h2 className={styles.footerHeading}>Khách mua vé</h2>
          <Link href="/events">Tất cả sự kiện</Link>
          <Link href="/me/tickets">Vé của tôi</Link>
          <Link href="/support">Hỗ trợ</Link>
        </nav>

        <nav className={styles.footerCol} aria-label="Dành cho ban tổ chức">
          <h2 className={styles.footerHeading}>Ban tổ chức</h2>
          <a href={organizerUrl}>Trang quản lý</a>
          <Link href="/support">Đăng ký bán vé</Link>
        </nav>

        <nav className={styles.footerCol} aria-label="Pháp lý">
          <h2 className={styles.footerHeading}>Pháp lý</h2>
          <Link href="/terms">Điều khoản sử dụng</Link>
          <Link href="/privacy">Chính sách bảo mật</Link>
        </nav>
      </div>

      <p className={styles.footerBottom}>© {new Date().getFullYear()} NexaTicket</p>
    </footer>
  );
}
