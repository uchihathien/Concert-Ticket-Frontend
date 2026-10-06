'use client';

import { getPublicEvent, type PublicEventDetail } from '@nexaticket/ts-sdk';
import { EmptyState, EventCard, eventCategoryLabel, formatDate, Skeleton } from '@nexaticket/ui';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { useSavedEvents } from '@/lib/saved-events';
import { SavableCard } from './SaveEventButton';
import styles from './saved-events.module.css';

/**
 * Danh sách sự kiện đã lưu. Trình duyệt chỉ giữ slug; chi tiết tải lại từ API công khai mỗi lần
 * mở — tên, ảnh, giá luôn mới. Sự kiện đã bị gỡ (404) vẫn có một dòng để khách tự bỏ lưu.
 */
export function SavedEventsList({ limit }: { limit?: number }) {
  const { slugs, remove } = useSavedEvents();
  const [loaded, setLoaded] = useState<Record<string, PublicEventDetail | null>>({});
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    const missing = slugs.filter((slug) => !(slug in loaded));
    if (missing.length === 0) return;
    void Promise.all(
      missing.map((slug) =>
        getPublicEvent(apiClient, slug)
          .then((event) => [slug, event] as const)
          .catch(() => [slug, null] as const),
      ),
    ).then((entries) => {
      if (active) setLoaded((current) => ({ ...current, ...Object.fromEntries(entries) }));
    });
    return () => {
      active = false;
    };
  }, [slugs, loaded]);

  if (slugs.length === 0) {
    return (
      <EmptyState
        title="Chưa lưu sự kiện nào"
        description="Nhấn biểu tượng lưu ở góc trên bên phải ảnh sự kiện để thêm vào đây."
        action={
          <Link href="/events" className={styles.cta}>
            Khám phá sự kiện
          </Link>
        }
      />
    );
  }

  const shown = limit ? slugs.slice(0, limit) : slugs;

  return (
    <div className={styles.grid}>
      {shown.map((slug) => {
        if (!(slug in loaded)) {
          return <Skeleton key={slug} height={260} />;
        }
        const event = loaded[slug];
        if (!event) {
          return (
            <div key={slug} className={styles.gone}>
              <span>Sự kiện không còn khả dụng</span>
              <button type="button" onClick={() => remove(slug)}>
                Bỏ lưu
              </button>
            </div>
          );
        }
        const next = [...event.sessions]
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
          .find((session) => Date.parse(session.startsAt) > now);
        const prices = event.sessions.flatMap((session) => session.tiers.map((tier) => tier.priceVnd));
        return (
          <SavableCard key={slug} slug={slug} title={event.title}>
            <EventCard
              href={`/events/${event.slug}`}
              title={event.title}
              tag={eventCategoryLabel(event.category)}
              dateLabel={next ? formatDate(next.startsAt) : 'Không còn suất sắp diễn'}
              venueLabel={event.venueName ?? event.city ?? '—'}
              fromPriceVnd={prices.length > 0 ? Math.min(...prices) : null}
              imageUrl={event.posterUrl ?? undefined}
              coverSeed={event.slug}
            />
          </SavableCard>
        );
      })}
    </div>
  );
}

/** Số sự kiện đã lưu — cho dòng lối tắt ở trang Tài khoản. */
export function SavedCount() {
  const { slugs } = useSavedEvents();
  return <>{slugs.length > 0 ? `${slugs.length} sự kiện` : 'Chưa có'}</>;
}
