import { formatDateLong, formatTime } from '@nexaticket/ui';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookingSteps } from '@/components/BookingSteps';
import { SeatPicker } from '@/components/SeatPicker';
import { loadSessionIndex } from '@/lib/session-index';
import styles from './booking-page.module.css';

/**
 * C-SEATS — chọn chỗ cho một suất diễn.
 *
 * <h3>Vì sao trang này cần đăng nhập</h3>
 *
 * Không nằm trong `publicPaths` của middleware, nên khách chưa đăng nhập bị đẩy sang `/login` rồi
 * quay lại đúng đây. Đó là cố ý: giữ chỗ gắn với một tài khoản (trần mua vé tính theo người), nên
 * cho xem sơ đồ rồi mới bắt đăng nhập ở bước bấm là hứa một thứ chưa chắc còn.
 *
 * <h3>Vì sao vẫn tra ngược ra tên sự kiện ở server</h3>
 *
 * Sơ đồ chỗ do inventory-service trả và nó không biết sự kiện tên gì — nó chỉ có
 * `eventSessionId`. Không tra thì tiêu đề trang là một UUID, và khách mở nhầm tab không có cách
 * nào biết mình đang mua vé sự kiện nào.
 */
export default async function BookingPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const index = await loadSessionIndex();
  const session = index[sessionId];

  // Suất không có trong catalog đang bán: hoặc id sai, hoặc sự kiện đã bị rút xuống. Cả hai đều là
  // 404 với khách — 404 không tiết lộ suất đó có tồn tại hay không.
  if (!session) notFound();

  return (
    <main className={styles.page}>
      {/*
        Breadcrumb dừng ở tên sự kiện, KHÔNG lặp lại bước hiện tại.

        Ngay dưới nó là stepper mở đầu bằng "① Chọn chỗ". Hai thanh điều hướng nằm sát nhau cùng
        nói một điều đọc như lỗi dựng hình — và mục cuối của breadcrumb vốn không bấm được, nên nó
        không giúp đi đâu cả. Phần còn lại thì có việc thật: quay về trang sự kiện.
      */}
      <nav className={styles.breadcrumb} aria-label="Đường dẫn">
        <Link href="/">Trang chủ</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/events/${session.slug}`}>{session.eventTitle}</Link>
      </nav>

      <BookingSteps current="seats" />

      <header className={styles.header}>
        <h1 className={styles.title}>{session.eventTitle}</h1>
        <p className={styles.meta}>
          {formatDateLong(session.startsAt)} · {formatTime(session.startsAt)}
          {session.venueName ? ` · ${session.venueName}` : ''}
          {session.city ? `, ${session.city}` : ''}
        </p>
      </header>

      <SeatPicker
        eventSessionId={sessionId}
        eventSlug={session.slug}
        eventTitle={session.eventTitle}
      />
    </main>
  );
}
