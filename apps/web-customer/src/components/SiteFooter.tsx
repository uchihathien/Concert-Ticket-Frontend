import { BrandLogo } from '@nexaticket/ui';
import Link from 'next/link';
import styles from './site.module.css';

/**
 * Footer bốn cột theo quy ước của site bán vé: giới thiệu, cho khách, cho ban tổ chức, pháp lý.
 *
 * Ban tổ chức là một nhóm người dùng riêng với app riêng, nên họ có cột riêng — nhét "Tạo sự
 * kiện" lẫn vào nhóm link của khách là chôn nó.
 */

/**
 * Liên kết mạng xã hội đọc từ biến môi trường, không viết cứng.
 *
 * Không có tài khoản nào thì hàng này biến mất. Trỏ đại vào `facebook.com/nexaticket` là dựng một
 * danh tính không tồn tại — người dùng bấm vào sẽ rơi vào trang lạ, và nếu ai đó đăng ký tên đó
 * thì đó là kênh mạo danh do chính footer của mình dẫn tới.
 */
const SOCIALS = [
  { label: 'Facebook', short: 'Fb', url: process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK },
  { label: 'YouTube', short: 'Yt', url: process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE },
  { label: 'Instagram', short: 'Ig', url: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM },
  { label: 'TikTok', short: 'Tt', url: process.env.NEXT_PUBLIC_SOCIAL_TIKTOK },
].filter((item): item is { label: string; short: string; url: string } => Boolean(item.url));

export function SiteFooter() {
  const organizerUrl = process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3001';
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  const hotline = process.env.NEXT_PUBLIC_SUPPORT_HOTLINE;

  return (
    <footer className={styles.footer}>
      <div className={styles.footerGrid}>
        <div className={styles.footerAbout}>
          <BrandLogo height={34} />
          <p className={styles.footerText}>
            Nền tảng bán vé sự kiện. Tiền vé được giữ hộ tới khi tới hạn đối soát với ban tổ chức.
          </p>

          {SOCIALS.length > 0 ? (
            <div className={styles.socials}>
              {SOCIALS.map((social) => (
                <a
                  key={social.label}
                  className={styles.social}
                  href={social.url}
                  aria-label={social.label}
                  // Link ra ngoài: `noreferrer` để trang đích không đọc được nơi người dùng đến từ.
                  target="_blank"
                  rel="noreferrer"
                >
                  <span aria-hidden="true">{social.short}</span>
                </a>
              ))}
            </div>
          ) : null}
        </div>

        <nav className={styles.footerCol} aria-label="Dành cho khách">
          <h2 className={styles.footerHeading}>Khách mua vé</h2>
          <Link href="/events">Tất cả sự kiện</Link>
          <Link href="/me/tickets">Vé của tôi</Link>
          <Link href="/me/orders">Đơn hàng của tôi</Link>
          <Link href="/support">Hỗ trợ</Link>
        </nav>

        <nav className={styles.footerCol} aria-label="Dành cho ban tổ chức">
          <h2 className={styles.footerHeading}>Ban tổ chức</h2>
          <a href={organizerUrl}>Trang quản lý</a>
          <Link href="/support">Đăng ký bán vé</Link>
        </nav>

        <nav className={styles.footerCol} aria-label="Pháp lý và liên hệ">
          <h2 className={styles.footerHeading}>Pháp lý</h2>
          <Link href="/terms">Điều khoản sử dụng</Link>
          <Link href="/privacy">Chính sách bảo mật</Link>
          {hotline ? <a href={`tel:${hotline.replace(/\s/g, '')}`}>Hotline {hotline}</a> : null}
          {supportEmail ? <a href={`mailto:${supportEmail}`}>{supportEmail}</a> : null}
        </nav>
      </div>

      <div className={styles.footerBottom}>
        <p>© {new Date().getFullYear()} NexaTicket</p>

        {/*
          Dấu "đã thông báo Bộ Công Thương" là ô trống có chú thích, không phải logo.
          Dán logo Bộ khi chưa nộp hồ sơ thật là hành vi bị xử phạt (Nghị định 98/2020, điều 62).
          Khi có mã đăng ký thật thì thay khối này bằng link do Bộ cấp.
        */}
        <p className={styles.legalBadge}>
          <span aria-hidden="true">▢</span>
          <span>Chỗ đặt dấu “Đã thông báo Bộ Công Thương” — gắn sau khi hoàn tất đăng ký.</span>
        </p>
      </div>
    </footer>
  );
}
