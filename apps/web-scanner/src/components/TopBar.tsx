import Link from 'next/link';
import { signOutStaff } from '@/app/actions';
import styles from './top-bar.module.css';

/**
 * Thanh trên cùng của MỌI trang web Soát vé — chọn suất, quét, tài khoản.
 *
 * Trái: nhận diện + trạng thái (giống thanh "NEXATICKET / GATE" của app Scanner). Phải: Tài khoản
 * và Đăng xuất — luôn ở cùng một góc trên mọi trang, nên nhân viên hết ca không phải đi tìm.
 */
export function TopBar() {
  return (
    <header className={styles.bar}>
      <Link href="/" className={styles.brand}>
        NEXATICKET / GATE
        <span className={styles.status}>
          <span className={styles.dot} aria-hidden="true" />
          SOÁT VÉ
        </span>
      </Link>
      <nav className={styles.actions} aria-label="Tài khoản nhân viên">
        <Link href="/account" className={styles.link}>
          Tài khoản
        </Link>
        <form action={signOutStaff}>
          <button type="submit" className={styles.signOut}>
            Đăng xuất
          </button>
        </form>
      </nav>
    </header>
  );
}
