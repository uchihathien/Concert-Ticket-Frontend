'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import styles from './hero.module.css';

export interface HeroSlide {
  href: string;
  kicker: string;
  title: string;
  meta: string;
  /** Dải màu nền, dùng khi sự kiện chưa có poster — và làm nền cho ảnh trong lúc tải. */
  background: string;
  /** Poster thật từ catalog. Không có thì chỉ còn dải màu. */
  imageUrl?: string;
}

const INTERVAL_MS = 6000;

/**
 * Băng rôn xoay vòng 3–5 slide (ui-direction.md §4).
 *
 * Ba điều kiện dừng tự chạy, tất cả đều bắt buộc: người dùng ưu tiên giảm chuyển động, con trỏ
 * đang trỏ vào, hoặc tiêu điểm bàn phím đang ở trong. Một băng rôn tự nhảy khi người ta đang đọc
 * là cách chắc chắn để họ không đọc hết.
 *
 * Slide là `<div>`, **không** phải link bọc ngoài: nút "Mua vé ngay" nằm bên trong, mà một `<a>`
 * lồng trong một `<a>` là HTML không hợp lệ — trình duyệt tự tháo ra và kết quả khác hẳn cái ta
 * viết. Thay vào đó nút mang `::before` phủ kín slide, nên cả tấm vẫn bấm được ở bất kỳ đâu mà
 * người dùng bàn phím chỉ gặp đúng một điểm dừng.
 */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, INTERVAL_MS);

    return () => clearInterval(timer);
  }, [paused, slides.length]);

  return (
    <div
      className={styles.hero}
      ref={containerRef}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      <div className={styles.viewport} aria-roledescription="băng rôn" aria-label="Sự kiện nổi bật">
        {slides.map((slide, i) => {
          const active = i === index;
          return (
            <div
              key={slide.href}
              className={active ? `${styles.slide} ${styles.slideActive}` : styles.slide}
              style={{ background: slide.background }}
              // Slide ẩn phải ra khỏi thứ tự tab và khỏi trình đọc màn hình.
              aria-hidden={!active}
            >
              {slide.imageUrl ? (
                // `alt` rỗng: tiêu đề nằm ngay bên dưới, đọc hai lần là ồn.
                // Chỉ slide đầu tải sớm — ba tấm 1200px cùng lúc là phí băng thông trên 4G.
                // Dùng `<img>` chứ không `next/image`: poster đến từ database nên tên miền không
                // biết trước lúc build, không khai được `images.remotePatterns`.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className={styles.slideImage}
                  src={slide.imageUrl}
                  alt=""
                  loading={i === 0 ? 'eager' : 'lazy'}
                  fetchPriority={i === 0 ? 'high' : 'low'}
                />
              ) : null}
              <div className={styles.slideBody}>
                <span className={styles.slideKicker}>{slide.kicker}</span>
                <h2 className={styles.slideTitle}>{slide.title}</h2>
                <p className={styles.slideMeta}>{slide.meta}</p>
                <Link
                  className={styles.slideCta}
                  href={slide.href}
                  tabIndex={active ? undefined : -1}
                >
                  Mua vé ngay
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.dots}>
        {slides.map((slide, i) => (
          <button
            key={slide.href}
            type="button"
            className={i === index ? `${styles.dot} ${styles.dotActive}` : styles.dot}
            aria-label={`Xem băng rôn ${i + 1}: ${slide.title}`}
            aria-current={i === index ? 'true' : undefined}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </div>
  );
}
