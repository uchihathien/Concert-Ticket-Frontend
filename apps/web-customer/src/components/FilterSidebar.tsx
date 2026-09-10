import Link from 'next/link';
import { PRICE_FILTERS, TIME_FILTERS, type QuickFilterOption } from '@nexaticket/ui';
import styles from './sidebar.module.css';

export interface FilterSidebarProps {
  when: string;
  price: string;
  city: string;
  /** Thành phố có sự kiện đang bán — backend gửi kèm trong chính response danh sách. */
  cities: string[];
  /** Dựng URL mới từ trạng thái hiện tại. Trang danh sách giữ hàm này vì nó biết đủ tham số. */
  linkWith: (patch: Record<string, string | number>) => string;
  /** Có bộ lọc nào đang bật không — quyết định hiện nút "Xoá bộ lọc". */
  filtered: boolean;
}

/**
 * Cột lọc nhanh của trang danh sách.
 *
 * Toàn bộ là `<Link>`, không có `<input>` và không có JavaScript: bộ lọc sống trên URL nên nó
 * chia sẻ được, mở tab mới được, quay lại được, và chạy trước cả khi bundle tải xong.
 *
 * Trên màn hẹp cột này nằm phía trên lưới và mỗi nhóm cuộn ngang thành một hàng chip — nhét cột
 * dọc vào 360px thì phải cuộn qua ba nhóm mới thấy được sự kiện đầu tiên.
 */
export function FilterSidebar({
  when,
  price,
  city,
  cities,
  linkWith,
  filtered,
}: FilterSidebarProps) {
  const cityOptions: QuickFilterOption[] = [
    { value: 'all', label: 'Toàn quốc' },
    ...cities.map((name) => ({ value: name, label: name })),
  ];

  return (
    <aside className={styles.sidebar} aria-label="Bộ lọc">
      <div className={styles.head}>
        <h2 className={styles.heading}>Bộ lọc</h2>
        {filtered ? (
          <Link className={styles.clear} href="/events">
            Xoá tất cả
          </Link>
        ) : null}
      </div>

      <Group
        title="Thời gian"
        options={TIME_FILTERS}
        active={when}
        // Đổi bộ lọc là về trang đầu — giữ số trang cũ sẽ rơi vào một trang trống.
        hrefFor={(value) => linkWith({ when: value, page: 0 })}
      />
      <Group
        title="Mức giá"
        options={PRICE_FILTERS}
        active={price}
        hrefFor={(value) => linkWith({ price: value, page: 0 })}
      />
      {cities.length > 0 ? (
        <Group
          title="Thành phố"
          options={cityOptions}
          active={city}
          hrefFor={(value) => linkWith({ city: value, page: 0 })}
        />
      ) : null}
    </aside>
  );
}

function Group({
  title,
  options,
  active,
  hrefFor,
}: {
  title: string;
  options: QuickFilterOption[];
  active: string;
  hrefFor: (value: string) => string;
}) {
  return (
    <section className={styles.group}>
      <h3 className={styles.groupTitle}>{title}</h3>
      <div className={styles.options}>
        {options.map((option) => {
          const selected = option.value === active;
          return (
            <Link
              key={option.value}
              href={hrefFor(option.value)}
              className={selected ? `${styles.option} ${styles.optionActive}` : styles.option}
              // Đây là một tập lựa chọn loại trừ nhau; `aria-current` là thứ trình đọc màn hình
              // dùng để báo "mục đang chọn" cho link.
              aria-current={selected ? 'true' : undefined}
            >
              {option.label}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
