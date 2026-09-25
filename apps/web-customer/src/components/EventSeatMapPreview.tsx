'use client';

import { usePublicFloorPlan, type PublicSession } from '@nexaticket/ts-sdk';
import { MoneyText, SeatMapCanvas, Skeleton } from '@nexaticket/ui';
import { useMemo } from 'react';
import styles from './seat-map-preview.module.css';

export interface EventSeatMapPreviewProps {
  eventSlug: string;
  /** Mọi suất của sự kiện. Giá gộp theo khu từ đây, không từ một suất riêng lẻ. */
  sessions: PublicSession[];
  /**
   * Sơ đồ ban tổ chức tải lên, backend đã giải sẵn ưu tiên sự kiện → địa điểm.
   *
   * Có thì dùng thay cho bản hệ thống tự vẽ. Đó là tấm họ đã dùng để bán vé ngoài đời: có lối
   * vào, có hướng sân khấu, nhiều khi in sẵn cả giá — những thứ hình học trong database không
   * biết. Vẽ đè cả hai lên nhau thì khách phải tự đoán tấm nào mới đúng.
   */
  seatMapImageUrl?: string | null;
}

/**
 * Sơ đồ khán phòng kèm giá từng khu, trên trang chi tiết sự kiện.
 *
 * <h3>Vì sao nó thuộc về trang này, không chỉ trang chọn chỗ</h3>
 *
 * Trang chi tiết là nơi khách quyết định <b>có mua hay không</b>. Câu hỏi của họ ở bước đó là "chỗ
 * nào nhìn rõ sân khấu, và nó bao nhiêu tiền" — bảng hạng vé trả lời được nửa sau, còn nửa trước
 * thì phải nhìn thấy hình khán phòng. Bắt họ bấm "Chọn chỗ" mới thấy được sơ đồ nghĩa là bắt cam
 * kết vào một suất cụ thể trước khi biết mình đang mua chỗ ngồi ở đâu.
 *
 * <h3>Chỉ để XEM, không chọn được</h3>
 *
 * Không truyền `onToggleSeat` và không truyền `seatMarks`: trang công khai không có tồn kho (nó
 * được cache và dùng chung cho mọi người), nên sơ đồ ở đây nói về <b>hình dạng khán phòng</b> chứ
 * không nói ghế nào còn. Vẽ ghế "còn trống" bằng dữ liệu không có thật sẽ là một lời hứa mà trang
 * chọn chỗ phải rút lại vài giây sau.
 *
 * <h3>Giá gộp theo khu, lấy khoảng thấp–cao</h3>
 *
 * Một khu có thể mang giá khác nhau giữa các suất (suất cuối tuần đắt hơn). Hiện giá của riêng suất
 * đầu là nói sai với người đang xem suất khác, nên khu nào có nhiều mức thì hiện khoảng.
 *
 * <h3>Mặt bằng hỏng thì khối này biến mất</h3>
 *
 * Không có `ErrorState`, không có ô báo lỗi. Sơ đồ là thông tin thêm; một sự kiện chưa khai hình
 * học vẫn bán vé bình thường, và một khung lỗi đỏ ở giữa trang chỉ làm khách nghĩ sự kiện có vấn đề.
 */
export function EventSeatMapPreview({
  eventSlug,
  sessions,
  seatMapImageUrl,
}: EventSeatMapPreviewProps) {
  const { data: floorPlan, isPending, isError } = usePublicFloorPlan(eventSlug);

  /** Khoảng giá của từng khu, gộp qua mọi suất. */
  const priceByZone = useMemo(() => {
    const byZone = new Map<string, { name: string; min: number; max: number }>();
    for (const session of sessions) {
      for (const tier of session.tiers) {
        const current = byZone.get(tier.zoneCode);
        if (!current) {
          byZone.set(tier.zoneCode, {
            name: tier.zoneName,
            min: tier.priceVnd,
            max: tier.priceVnd,
          });
          continue;
        }
        current.min = Math.min(current.min, tier.priceVnd);
        current.max = Math.max(current.max, tier.priceVnd);
      }
    }
    return byZone;
  }, [sessions]);

  const zones = [...priceByZone.entries()].sort((a, b) => b[1].min - a[1].min);

  // Có ảnh của ban tổ chức thì không cần chờ mặt bằng: ảnh đã là câu trả lời, và chờ một lời gọi
  // mạng nữa chỉ để rồi bỏ kết quả đi là làm khối này hiện muộn hơn cần thiết.
  if (seatMapImageUrl) {
    return (
      <div className={styles.layout}>
        <figure className={styles.imageFigure}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh từ kho vật thể, tên miền
              cấu hình lúc chạy nên không khai trước được cho next/image. */}
          <img className={styles.image} src={seatMapImageUrl} alt="Sơ đồ khu vực ghế" />
        </figure>
        <ZonePrices zones={zones} />
      </div>
    );
  }

  if (isPending) {
    return <Skeleton lines={6} />;
  }
  if (isError || !floorPlan) {
    return null;
  }

  // Toạ độ ghế không nằm trong mặt bằng công khai, nên khối này chỉ vẽ hình dạng khán phòng. Vẫn
  // phải hỏi: một mặt bằng không có khu nào thì không có gì để xem.
  if (floorPlan.zones.length === 0) {
    return null;
  }

  return (
    <div className={styles.layout}>
      <div className={styles.canvas}>
        <SeatMapCanvas floorPlan={floorPlan} label={`Sơ đồ khán phòng ${floorPlan.venueName}`} />
      </div>

      <ZonePrices zones={zones} />
    </div>
  );
}

/** Bảng giá theo khu. Tách ra vì cả hai cách hiển thị sơ đồ đều kèm đúng bảng này. */
function ZonePrices({
  zones,
}: {
  zones: Array<[string, { name: string; min: number; max: number }]>;
}) {
  if (zones.length === 0) return null;

  return (
    <ul className={styles.prices}>
      {zones.map(([zoneCode, price]) => (
        <li key={zoneCode} className={styles.priceRow}>
          <span className={styles.zoneName}>
            {price.name}
            <span className={styles.zoneCode}>{zoneCode}</span>
          </span>
          <span className={styles.zonePrice}>
            {price.min === price.max ? (
              <MoneyText amountVnd={price.min} strong />
            ) : (
              <>
                <MoneyText amountVnd={price.min} strong /> – <MoneyText amountVnd={price.max} />
              </>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
