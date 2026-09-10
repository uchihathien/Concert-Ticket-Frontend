import {
  ApiError,
  fromPriceOf,
  getPublicEvent,
  type PublicEventDetail,
  type PublicSession,
} from '@nexaticket/ts-sdk';
import {
  Badge,
  Button,
  MoneyText,
  coverGradient,
  eventCategoryLabel,
  formatDate,
  formatDateLong,
  formatTime,
  formatVnd,
} from '@nexaticket/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { serverApi } from '@/lib/server-api';
import styles from './detail.module.css';

/** Backend đặt Cache-Control 2 phút; ISR khớp theo. */
export const revalidate = 120;

/** Neo của khối thông tin vé — nút CTA ở băng rôn cuộn xuống đây. */
const TICKETS_ANCHOR = 'thong-tin-ve';

/**
 * C-DETAIL — trang công khai, có SEO.
 *
 * Bố cục theo quy ước của sàn bán vé: băng rôn tràn viền có poster làm nền mờ, khối thông tin
 * (tên, ngày, địa điểm, giá từ, nút mua) nằm đè lên bên trái, poster thật bên phải. Bên dưới là
 * các khối một cột: Giới thiệu → Thông tin vé → Địa điểm.
 *
 * Bỏ cột phải: bản trước lặp lại đúng ba dòng ngày/địa điểm/giá đã có ở băng rôn. Cùng một thông
 * tin ở hai chỗ trên cùng một màn hình thì một trong hai chỗ là thừa.
 *
 * Không còn `generateStaticParams`: danh sách sự kiện thay đổi theo ngày, nên sinh sẵn đường dẫn
 * lúc build sẽ bỏ sót mọi sự kiện xuất bản sau đó. ISR 2 phút cho HTML đầy đủ mà vẫn theo kịp.
 *
 * "Mua vé ngay" ở băng rôn cuộn xuống khối vé chứ không nhảy thẳng vào một suất: sự kiện thường
 * có nhiều suất, và chọn hộ khách một suất là đoán sai một nửa số lần. Từ đó mỗi suất có nút
 * "Chọn chỗ" riêng dẫn sang `/booking/{sessionId}`.
 */
async function loadEvent(slug: string): Promise<PublicEventDetail | null> {
  try {
    return await getPublicEvent(serverApi, slug);
  } catch (error) {
    // Slug sai hoặc sự kiện chưa xuất bản → 404 thật, để công cụ tìm kiếm bỏ đường dẫn chết.
    // Mọi lỗi khác (mạng, 5xx) phải ném tiếp: biến sự cố máy chủ thành "không tìm thấy" là giấu
    // mất một sự cố có thật.
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await loadEvent(slug);
  if (!event) return { title: 'Không tìm thấy sự kiện — NexaTicket' };

  return {
    title: `${event.title} — NexaTicket`,
    description: event.summary ?? undefined,
    openGraph: event.posterUrl ? { images: [event.posterUrl] } : undefined,
  };
}

export default async function EventDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await loadEvent(slug);
  if (!event) notFound();

  const soonest = event.sessions[0] ?? null;
  const now = Date.now();

  // Suất còn bán được (hoặc sắp mở bán). Sự kiện đã qua vẫn giữ trang để tra cứu, nhưng nó không
  // được hiện giá và nút mua — bản trước vẫn mời "Mua vé ngay" ngay bên trên dòng
  // "Đã hết hạn bán vé" của chính suất đó.
  const sellable = event.sessions.filter((session) => salesCloseOf(session) > now);

  // Giá thấp nhất trong các suất CÒN BÁN, không phải của riêng suất đầu: khách đọc "từ 300.000đ"
  // rồi mở ra thấy suất nào cũng 500.000đ thì đó là con số sai, dù suất đầu tiên có đúng.
  const prices = sellable.map(fromPriceOf).filter((price): price is number => price !== null);
  const fromPrice = prices.length > 0 ? Math.min(...prices) : null;
  const ended = event.sessions.length > 0 && sellable.length === 0;

  const venueLine = [event.venueName, event.city].filter(Boolean).join(', ');
  const mapQuery = [event.venueName, event.venueAddress, event.city].filter(Boolean).join(', ');

  return (
    <main>
      <section className={styles.hero}>
        {/* Poster làm nền, thổi to và làm mờ. Sự kiện chưa có poster thì rơi về dải màu của
            chính nó — cùng dải màu với thẻ ở trang chủ, nên khách nhận ra mình vừa bấm vào đâu. */}
        <div className={styles.heroBackdrop} style={{ background: coverGradient(event.slug) }}>
          {event.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.heroBackdropImage} src={event.posterUrl} alt="" aria-hidden />
          ) : null}
        </div>

        <div className={styles.heroInner}>
          <nav className={styles.crumbs} aria-label="Đường dẫn">
            <Link href="/">Trang chủ</Link>
            <span aria-hidden="true">/</span>
            <Link href={`/events?category=${event.category}`}>
              {eventCategoryLabel(event.category)}
            </Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{event.title}</span>
          </nav>

          <div className={styles.heroGrid}>
            <div className={styles.heroInfo}>
              <div className={styles.heroTags}>
                <Badge tone="accent">{eventCategoryLabel(event.category)}</Badge>
                {event.sessions.length === 0 ? <Badge tone="warn">Chưa mở bán</Badge> : null}
                {ended ? <Badge tone="warn">Đã kết thúc</Badge> : null}
              </div>

              <h1 className={styles.title}>{event.title}</h1>
              {event.summary ? <p className={styles.summary}>{event.summary}</p> : null}

              <dl className={styles.facts}>
                <div className={styles.fact}>
                  <dt className={styles.factLabel}>
                    <span className={styles.factIcon} aria-hidden="true">
                      ▤
                    </span>
                    Thời gian
                  </dt>
                  <dd className={styles.factBody}>
                    {soonest ? (
                      <>
                        {formatDateLong(soonest.startsAt)} · {formatTime(soonest.startsAt)}
                        {event.sessions.length > 1 ? (
                          <span className={styles.factNote}>
                            và {event.sessions.length - 1} suất khác
                          </span>
                        ) : null}
                      </>
                    ) : (
                      'Chưa có suất diễn'
                    )}
                  </dd>
                </div>

                <div className={styles.fact}>
                  <dt className={styles.factLabel}>
                    <span className={styles.factIcon} aria-hidden="true">
                      ◎
                    </span>
                    Địa điểm
                  </dt>
                  <dd className={styles.factBody}>
                    {venueLine || '—'}
                    {event.venueAddress ? (
                      <span className={styles.factNote}>{event.venueAddress}</span>
                    ) : null}
                  </dd>
                </div>
              </dl>

              <div className={styles.heroBuy}>
                <p className={styles.heroPrice}>
                  {fromPrice === null ? (
                    <span className={styles.heroPriceOff}>
                      {ended ? 'Đã hết hạn bán vé' : 'Chưa mở bán'}
                    </span>
                  ) : (
                    <>
                      <span className={styles.heroPriceLabel}>Giá từ</span>
                      <MoneyText amountVnd={fromPrice} strong />
                    </>
                  )}
                </p>

                {sellable.length > 0 ? (
                  <a className={styles.heroCta} href={`#${TICKETS_ANCHOR}`}>
                    Mua vé ngay
                  </a>
                ) : null}
              </div>
            </div>

            <div className={styles.heroPoster}>
              <div
                className={styles.heroPosterFrame}
                style={{ background: coverGradient(event.slug) }}
              >
                {event.posterUrl ? (
                  // Dùng `<img>` chứ không `next/image`: poster đến từ database nên tên miền
                  // không biết trước lúc build, không khai được `images.remotePatterns`.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={event.posterUrl} alt={`Áp phích ${event.title}`} fetchPriority="high" />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className={styles.page}>
        {event.description ? (
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>Giới thiệu</h2>
            <div className={styles.prose}>
              {event.description
                .split('\n')
                .filter(Boolean)
                .map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
            </div>
          </section>
        ) : null}

        <section className={styles.panel} id={TICKETS_ANCHOR}>
          <h2 className={styles.panelTitle}>Thông tin vé</h2>
          {/*
            Nói thẳng vì sao nút khoá. `title` không hiện trên màn cảm ứng, nên nếu không có dòng
            này thì trên điện thoại nút chỉ đơn giản là bấm không ăn.
          */}
          {sellable.length > 0 ? (
            <p className={styles.note}>
              Chọn chỗ rồi thanh toán bằng chuyển khoản. Chỗ được giữ trong ít phút để bạn hoàn tất.
            </p>
          ) : null}
          {event.sessions.length === 0 ? (
            <p className={styles.note}>Sự kiện chưa có suất diễn nào đang mở bán.</p>
          ) : (
            <ul className={styles.sessions}>
              {event.sessions.map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
            </ul>
          )}
        </section>

        {venueLine ? (
          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>Địa điểm</h2>
            <p className={styles.venueName}>{event.venueName ?? event.city}</p>
            {event.venueAddress ? (
              <p className={styles.venueAddress}>{event.venueAddress}</p>
            ) : null}
            {/*
              Link tra cứu trên Google Maps dựng từ chính địa chỉ trong database. Là URL tìm kiếm
              chứ không phải toạ độ hay place id — backend không lưu hai thứ đó, và bịa ra một
              điểm trên bản đồ thì khách sẽ đi nhầm chỗ.
            */}
            {mapQuery ? (
              <a
                className={styles.mapLink}
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`}
                target="_blank"
                rel="noreferrer"
              >
                Tìm trên Google Maps
              </a>
            ) : null}
          </section>
        ) : null}
      </div>

      {/* CTA dính đáy, chỉ trên màn hẹp: ở đó băng rôn đã cuộn khuất từ lâu. */}
      <div className={styles.stickyCta}>
        <span className={styles.stickyPrice}>
          {fromPrice === null ? (
            ended ? (
              'Đã hết hạn bán vé'
            ) : (
              'Chưa mở bán'
            )
          ) : (
            <>
              Từ <MoneyText amountVnd={fromPrice} strong />
            </>
          )}
        </span>
        {sellable.length > 0 ? (
          <a className={styles.heroCta} href={`#${TICKETS_ANCHOR}`}>
            Mua vé ngay
          </a>
        ) : null}
      </div>
    </main>
  );
}

/**
 * Một suất diễn: ngày giờ, cửa sổ bán vé, và bảng hạng vé.
 *
 * Bản trước chỉ nối tên hạng vé bằng dấu chấm giữa. Giá từng hạng là thứ khách cần để quyết định
 * và backend đã trả sẵn trong `tiers` — không hiện ra là bắt họ bấm vào mới biết.
 */
/**
 * Mốc ngừng bán của một suất.
 *
 * `salesCloseAt` có thể để trống, khi đó lấy giờ diễn: không ai bán vé cho một suất đã diễn xong.
 * Băng rôn và danh sách suất phải dùng chung hàm này, nếu không hai chỗ sẽ bất đồng về việc sự
 * kiện còn bán hay không.
 */
function salesCloseOf(session: PublicSession): number {
  const closes = session.salesCloseAt
    ? Date.parse(session.salesCloseAt)
    : Date.parse(session.startsAt);
  return Number.isNaN(closes) ? 0 : closes;
}

function SessionCard({ session }: { session: PublicSession }) {
  const price = fromPriceOf(session);
  const now = Date.now();

  // Chỉ hiện giờ kết thúc khi nó rơi vào cùng ngày. Suất chạy qua nửa đêm sẽ hiện "18:00 – 00:00",
  // đọc như thể kết thúc trước lúc bắt đầu.
  const sameDayEnd =
    session.endsAt !== null && formatDate(session.startsAt) === formatDate(session.endsAt);

  const opensAt = session.salesOpenAt ? Date.parse(session.salesOpenAt) : null;

  // Ba trạng thái tách bạch: chưa tới giờ mở bán, đã đóng, hoặc đang bán.
  const notYetOpen = opensAt !== null && opensAt > now;
  const closed = salesCloseOf(session) <= now;

  return (
    <li className={styles.session}>
      <div className={styles.sessionHead}>
        <div>
          <p className={styles.sessionDate}>{formatDateLong(session.startsAt)}</p>
          <p className={styles.sessionTime}>
            {formatTime(session.startsAt)}
            {sameDayEnd ? ` – ${formatTime(session.endsAt as string)}` : ''}
          </p>
        </div>

        <div className={styles.sessionAction}>
          {price === null ? (
            <span className={styles.notOnSale}>Chưa có hạng vé</span>
          ) : (
            <span className={styles.sessionPrice}>
              Từ <MoneyText amountVnd={price} strong />
            </span>
          )}
          {/* Suất đã đóng bán thì không còn nút: một nút "Chọn chỗ" ngay trên dòng
              "Đã hết hạn bán vé" chỉ khiến người đọc phải bấm thử mới biết. */}
          {closed ? null : notYetOpen ? (
            // Chưa tới giờ mở bán: nút vẫn hiện nhưng khoá, và dòng "Mở bán từ …" ngay bên dưới
            // nói vì sao. Ẩn hẳn nút thì khách không biết suất này rồi sẽ bán.
            <Button variant="primary" disabled aria-describedby={`sale-${session.id}`}>
              Chọn chỗ
            </Button>
          ) : (
            // `Link` mang style của nút thay vì `<Button onClick={router.push}>`: đây là một
            // điều hướng thật, nên nó phải mở được bằng Ctrl+click và chuột giữa, và phải hiện
            // đích ở thanh trạng thái. Một nút giả link lấy mất cả ba.
            <Link className={styles.sessionCta} href={`/booking/${session.id}`}>
              Chọn chỗ
            </Link>
          )}
        </div>
      </div>

      {notYetOpen || closed ? (
        <p className={styles.saleWindow} id={`sale-${session.id}`}>
          {notYetOpen
            ? `Mở bán từ ${formatDate(session.salesOpenAt as string)} · ${formatTime(session.salesOpenAt as string)}`
            : 'Đã hết hạn bán vé'}
        </p>
      ) : null}

      {session.tiers.length > 0 ? (
        <ul className={styles.tiers}>
          {session.tiers.map((tier) => (
            <li key={tier.id} className={styles.tier}>
              <span className={styles.tierName}>{tier.name}</span>
              <span className={styles.tierZone}>{tier.zoneName}</span>
              <span className={styles.tierPrice}>{formatVnd(tier.priceVnd)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
