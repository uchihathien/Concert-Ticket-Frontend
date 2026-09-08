import { Badge, Button, MoneyText, coverGradient, formatDateTime } from '@nexaticket/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PLACEHOLDER_EVENTS, findEvent, nextSession } from '@/lib/placeholder-events';
import styles from './detail.module.css';

/**
 * C-DETAIL — trang công khai, có SEO.
 *
 * Sinh sẵn đường dẫn cho mọi sự kiện đang có: đây là trang khách hay vào từ Google và từ link
 * chia sẻ, nên nó phải trả về HTML đầy đủ chứ không phải khung rỗng chờ JavaScript.
 *
 * Nút "Chọn chỗ" hiện đang khoá: sơ đồ chỗ (C-SEATS, `packages/seatmap`) là hạng mục G2. API
 * tồn kho thì đã có, phần còn thiếu là màn vẽ ghế.
 */
export function generateStaticParams() {
  return PLACEHOLDER_EVENTS.map((event) => ({ slug: event.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = findEvent(slug);
  if (!event) return { title: 'Không tìm thấy sự kiện — NexaTicket' };

  return {
    title: `${event.title} — NexaTicket`,
    description: event.summary,
  };
}

export default async function EventDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = findEvent(slug);

  // 404 thật, không phải màn "không tìm thấy" tự vẽ: slug sai phải trả đúng mã trạng thái để
  // công cụ tìm kiếm không giữ lại đường dẫn chết.
  if (!event) notFound();

  const soonest = nextSession(event);

  return (
    <main className={styles.page}>
      <nav className={styles.crumbs} aria-label="Đường dẫn">
        <Link href="/">Trang chủ</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/events?category=${event.category}`}>Sự kiện</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{event.title}</span>
      </nav>

      {/* Cùng dải màu với thẻ ở trang trước — người dùng phải nhận ra mình vừa bấm vào cái gì. */}
      <section
        className={styles.banner}
        style={{ background: coverGradient(event.slug) }}
        aria-hidden="true"
      />

      <div className={styles.body}>
        <div className={styles.main}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{event.title}</h1>
            {event.badge ? <Badge tone="accent">{event.badge}</Badge> : null}
          </div>
          <p className={styles.summary}>{event.summary}</p>

          <h2 className={styles.sectionTitle}>Giới thiệu</h2>
          {event.description.map((paragraph) => (
            <p key={paragraph} className={styles.paragraph}>
              {paragraph}
            </p>
          ))}

          <h2 className={styles.sectionTitle}>Chọn suất diễn</h2>
          <ul className={styles.sessions}>
            {event.sessions.map((session) => (
              <li key={session.id} className={styles.session}>
                <div>
                  <p className={styles.sessionTime}>{formatDateTime(session.startsAt)}</p>
                  <p className={styles.sessionVenue}>
                    {session.venue} · {session.city}
                  </p>
                </div>
                <div className={styles.sessionAction}>
                  {session.fromPriceVnd === null ? (
                    <span className={styles.notOnSale}>Chưa mở bán</span>
                  ) : (
                    <span className={styles.sessionPrice}>
                      Từ <MoneyText amountVnd={session.fromPriceVnd} strong />
                    </span>
                  )}
                  {/* Nút phụ, không phải nút chính mờ đi: một cột nút đỏ nhạt đọc như CTA hỏng. */}
                  <Button variant="secondary" disabled title="Sơ đồ chỗ ngồi mở ở giai đoạn G2">
                    Chọn chỗ
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          <p className={styles.note}>
            Chọn chỗ và thanh toán sẽ mở cùng màn sơ đồ chỗ ngồi. Trang này hiện dùng dữ liệu mẫu vì
            dịch vụ danh mục sự kiện chưa phát hành API.
          </p>
        </div>

        <aside className={styles.aside}>
          <div className={styles.card}>
            <p className={styles.cardLabel}>Suất gần nhất</p>
            <p className={styles.cardValue}>
              {soonest ? formatDateTime(soonest.startsAt) : 'Chưa có suất'}
            </p>
            <p className={styles.cardLabel}>Địa điểm</p>
            <p className={styles.cardValue}>
              {soonest ? `${soonest.venue}, ${soonest.city}` : '—'}
            </p>
            <p className={styles.cardLabel}>Giá từ</p>
            <p className={styles.cardValue}>
              {soonest?.fromPriceVnd == null ? (
                'Chưa mở bán'
              ) : (
                <MoneyText amountVnd={soonest.fromPriceVnd} strong />
              )}
            </p>
          </div>
        </aside>
      </div>

      {/* CTA dính đáy trên mobile — không phải cuộn ngược lên để mua (ui-direction.md §1). */}
      <div className={styles.stickyCta}>
        <span className={styles.stickyPrice}>
          {soonest?.fromPriceVnd == null ? (
            'Chưa mở bán'
          ) : (
            <>
              Từ <MoneyText amountVnd={soonest.fromPriceVnd} strong />
            </>
          )}
        </span>
        <Button disabled size="lg" title="Sơ đồ chỗ ngồi mở ở giai đoạn G2">
          Chọn chỗ
        </Button>
      </div>
    </main>
  );
}
