'use client';

import { useSavedEvents } from '@/lib/saved-events';
import styles from './save-event.module.css';

/**
 * Nút lưu ở góc trên bên phải ảnh sự kiện.
 *
 * Là ANH EM của thẻ (thẻ là một <a>), không nằm trong nó: nút trong link là HTML sai, và bấm nút
 * sẽ kéo theo cả điều hướng. Vị trí đè lên góc ảnh do lớp bao (`.cardWrap` / khung poster) lo.
 */
export function SaveEventButton({ slug, title, size = 'md' }: { slug: string; title: string; size?: 'md' | 'lg' }) {
  const { isSaved, toggle } = useSavedEvents();
  const saved = isSaved(slug);

  return (
    <button
      type="button"
      className={styles.button}
      data-size={size}
      data-saved={saved || undefined}
      aria-pressed={saved}
      aria-label={saved ? `Bỏ lưu ${title}` : `Lưu ${title}`}
      title={saved ? 'Bỏ lưu' : 'Lưu sự kiện'}
      onClick={() => toggle(slug)}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z" />
      </svg>
    </button>
  );
}

/** Thẻ sự kiện + nút lưu đè góc ảnh. Dùng thay `EventCard` ở mọi lưới/dải thẻ. */
export function SavableCard({ slug, title, children }: { slug: string; title: string; children: React.ReactNode }) {
  return (
    <div className={styles.cardWrap}>
      {children}
      <SaveEventButton slug={slug} title={title} />
    </div>
  );
}
