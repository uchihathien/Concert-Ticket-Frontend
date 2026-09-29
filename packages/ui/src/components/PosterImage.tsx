'use client';

import { useState } from 'react';
import { cx } from '../cx';
import styles from './poster-image.module.css';

export interface PosterImageProps {
  /** URL từ database. `null` hoặc rỗng thì không dựng gì — nền bên dưới lộ ra. */
  src: string | null | undefined;
  /**
   * Mô tả cho trình đọc màn hình.
   *
   * Để chuỗi rỗng khi ảnh chỉ để trang trí và tên sự kiện đã nằm ngay cạnh dưới dạng chữ —
   * đọc lại tên hai lần là tiếng ồn, không phải hỗ trợ.
   */
  alt: string;
  /** Ảnh nền phía sau (hero) chứ không phải nội dung — bỏ hẳn khỏi cây trợ năng. */
  decorative?: boolean;
  /** `eager` cho ảnh ở màn đầu; mặc định `lazy`. */
  loading?: 'lazy' | 'eager';
  className?: string;
}

/**
 * Ảnh bìa đến từ database.
 *
 * <h3>Vì sao không dùng thẳng `<img>`</h3>
 *
 * Ba chỗ trong app khách nhúng `poster_url`, và cả ba đều đặt ảnh **chồng lên một dải màu nền**.
 * Dải màu ấy đã là phương án dự phòng tử tế cho sự kiện chưa có ảnh — nhưng nó chỉ hoạt động khi
 * `posterUrl` rỗng. Lúc URL **có** mà ảnh **không tải được**, trình duyệt vẽ biểu tượng ảnh vỡ
 * đè lên trên, và cả trang danh sách thành một lưới ô vỡ.
 *
 * Chuyện đó không hiếm kể từ khi ảnh nằm trong kho vật thể của chính mình: kho chưa chạy ở máy
 * phát triển, hoặc vật thể đã bị xoá. Ở đây, ảnh hỏng thì **tự gỡ mình đi** và dải màu bên dưới
 * lộ ra — người dùng thấy một tấm bìa có chủ đích thay vì một lỗi.
 *
 * <h3>Hiện dần thay vì nhảy vào</h3>
 *
 * Ảnh bắt đầu trong suốt và hiện dần khi tải xong. Không có bước này thì poster "nhảy" đè lên dải
 * màu — rõ nhất trên lưới nhiều thẻ, nơi mỗi ảnh xong ở một thời điểm khác nhau và cả lưới nhấp
 * nháy dần.
 *
 * <h3>Đây là client component, và nó cố ý nhỏ</h3>
 *
 * `onError` và `onLoad` buộc phải chạy ở trình duyệt. Tách riêng chỉ phần ảnh để `EventCard` và
 * trang chi tiết vẫn là server component — chữ, liên kết và dữ liệu giá vẫn nằm trong HTML đầu
 * tiên, vốn là thứ Google đọc và là thứ quyết định LCP.
 */
export function PosterImage({ src, alt, decorative, loading = 'lazy', className }: PosterImageProps) {
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');

  // Không có ảnh, hoặc ảnh hỏng: không dựng gì cả. Nền bên dưới chính là phương án dự phòng.
  if (!src || state === 'failed') {
    return null;
  }

  // `<img>` chứ không `next/image`: poster đến từ database nên tên miền chỉ biết lúc chạy, không
  // khai trước được vào `images.remotePatterns`. Không có chỉ thị tắt rule ở đây vì `packages/ui`
  // không phải app Next — nó không chạy plugin ấy, và một chỉ thị trỏ vào rule không tồn tại là
  // một lỗi lint thật.
  return (
    <img
      className={cx(styles.image, state === 'ready' && styles.ready, className)}
      src={src}
      alt={decorative ? '' : alt}
      aria-hidden={decorative ? true : undefined}
      loading={loading}
      // `decoding="async"` để giải mã ảnh không chặn luồng dựng hình — đáng kể ở lưới nhiều thẻ.
      decoding="async"
      onLoad={() => setState('ready')}
      onError={() => setState('failed')}
    />
  );
}
