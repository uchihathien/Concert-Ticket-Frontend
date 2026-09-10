'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import styles from './site.module.css';

export interface CityPickerProps {
  /** Thành phố có sự kiện đang bán, lấy từ `GET /v1/events` — không gõ tay. */
  cities: string[];
}

/**
 * Chọn thành phố ở header.
 *
 * Đổi thành phố là điều hướng sang `/events?city=…` chứ không lọc tại chỗ: bộ lọc sống trên URL
 * nên chia sẻ được, và người dùng đang ở trang chủ mà chọn thành phố thì thứ họ muốn xem là
 * *danh sách sự kiện ở đó*, không phải trang chủ được lọc.
 *
 * Là `<select>` gốc chứ không phải dropdown tự vẽ: trên điện thoại nó mở bộ chọn của hệ điều
 * hành, cuộn bằng ngón cái, và hoạt động với trình đọc màn hình mà không cần thêm dòng code nào.
 */
export function CityPicker({ cities }: CityPickerProps) {
  const router = useRouter();
  // Đọc thẳng từ URL thay vì nhận qua prop: header nằm trong layout, mà layout của App Router
  // không nhận `searchParams`.
  const value = useSearchParams().get('city') ?? 'all';

  return (
    <label className={styles.city}>
      <span className={styles.cityIcon} aria-hidden="true">
        ◎
      </span>
      <select
        className={styles.citySelect}
        aria-label="Chọn thành phố"
        value={value}
        onChange={(event) => {
          const city = event.target.value;
          router.push(city === 'all' ? '/events' : `/events?city=${encodeURIComponent(city)}`);
        }}
      >
        <option value="all">Toàn quốc</option>
        {cities.map((city) => (
          <option key={city} value={city}>
            {city}
          </option>
        ))}
      </select>
    </label>
  );
}
