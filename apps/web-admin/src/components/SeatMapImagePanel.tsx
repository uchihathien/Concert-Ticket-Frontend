'use client';

import { useSeatMapImages, useSetSeatMapImage } from '@nexaticket/ts-sdk';
import { Skeleton } from '@nexaticket/ui';
import { PosterUploader } from './PosterUploader';
import styles from './seat-map-image-panel.module.css';

export interface SeatMapImagePanelProps {
  organizationId: string;
  eventId: string;
  venueId: string;
  venueName: string;
  /** Khoá sinh dải màu nền tạm. Hai khung trên cùng màn hình phải khác khoá — xem ghi chú bên dưới. */
  eventSlug: string;
}

/**
 * Sơ đồ khu vực ghế: một tấm cho địa điểm, một tấm riêng cho sự kiện.
 *
 * <h3>Vì sao hai chỗ chứ không một</h3>
 *
 * Hình dạng khán phòng thuộc về **địa điểm** — một nhà hát không đổi chỗ ngồi theo từng đêm diễn,
 * nên tải một lần rồi mọi sự kiện ở đó dùng chung là đúng. Nhưng rất nhiều sơ đồ bán vé in **giá
 * và tên hạng vé** ngay trên hình, mà hai thứ đó đổi theo từng sự kiện. Nên có thêm một tấm riêng,
 * và nó đè lên tấm chung.
 *
 * <h3>Vì sao phải hiện cả hai cùng lúc</h3>
 *
 * Đây là phần dễ gây hiểu nhầm nhất và là lý do màn hình này tồn tại thay vì hai nút rời: gỡ ảnh
 * riêng của sự kiện xong, ảnh của địa điểm hiện lên thế chỗ — nhìn từ ngoài thì nút "xoá" vừa bấm
 * trông như **không chạy**. Thấy được cả hai ô cùng lúc thì chuyện đó tự giải thích.
 */
export function SeatMapImagePanel({
  organizationId,
  eventId,
  venueId,
  venueName,
  eventSlug,
}: SeatMapImagePanelProps) {
  const { data, isPending } = useSeatMapImages(organizationId, eventId);
  const save = useSetSeatMapImage(organizationId, eventId, venueId);

  if (isPending || !data) {
    return <Skeleton lines={4} />;
  }

  return (
    <div className={styles.wrap}>
      <section className={styles.slot}>
        <h3 className={styles.slotTitle}>Sơ đồ riêng của sự kiện này</h3>
        <p className={styles.slotNote}>
          Dùng khi sơ đồ có in giá hoặc tên hạng vé của chính sự kiện. Để trống thì khách thấy sơ đồ
          chung của địa điểm.
        </p>
        <PosterUploader
          organizationId={organizationId}
          posterUrl={data.eventImageUrl}
          coverSeed={`${eventSlug}-so-do`}
          previewFit="contain"
          onSave={async (imageUrl) => {
            await save.mutateAsync({ scope: 'event', imageUrl });
          }}
          labels={{
            empty: 'Chưa có sơ đồ riêng',
            upload: 'Tải sơ đồ',
            replace: 'Đổi sơ đồ',
            remove: 'Gỡ sơ đồ riêng',
            alt: 'Sơ đồ riêng của sự kiện',
            hint: 'JPEG, PNG hoặc WebP. Ảnh dọc hay ngang đều được, hệ thống không cắt.',
          }}
        />
      </section>

      <section className={styles.slot}>
        <h3 className={styles.slotTitle}>Sơ đồ chung của {venueName}</h3>
        <p className={styles.slotNote}>
          Dùng cho <b>mọi</b> sự kiện của bạn tại địa điểm này. Sửa ở đây là sửa cho cả những sự
          kiện khác.
        </p>
        <PosterUploader
          organizationId={organizationId}
          posterUrl={data.venueImageUrl}
          coverSeed={`${venueId}-so-do`}
          previewFit="contain"
          onSave={async (imageUrl) => {
            await save.mutateAsync({ scope: 'venue', imageUrl });
          }}
          labels={{
            empty: 'Chưa có sơ đồ địa điểm',
            upload: 'Tải sơ đồ',
            replace: 'Đổi sơ đồ',
            remove: 'Gỡ sơ đồ địa điểm',
            alt: `Sơ đồ ${venueName}`,
            hint: 'JPEG, PNG hoặc WebP. Ảnh dọc hay ngang đều được, hệ thống không cắt.',
          }}
        />
      </section>

      <p className={styles.effective}>
        {data.effectiveImageUrl === null
          ? 'Khách đang thấy sơ đồ hệ thống tự vẽ từ hình học của địa điểm.'
          : data.effectiveImageUrl === data.eventImageUrl
            ? 'Khách đang thấy sơ đồ riêng của sự kiện này.'
            : 'Khách đang thấy sơ đồ chung của địa điểm.'}
      </p>
    </div>
  );
}
