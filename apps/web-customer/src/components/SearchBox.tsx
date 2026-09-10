'use client';

import { useSearchParams } from 'next/navigation';
import styles from './site.module.css';

/**
 * Ô tìm kiếm toàn cục ở header.
 *
 * Là `<form method="get">` trỏ thẳng vào `/events`: tìm kiếm chạy được cả khi JavaScript chưa tải
 * xong, và từ khoá nằm trên URL nên chia sẻ được, quay lại được, index được.
 *
 * Client component chỉ vì một lý do: đọc `?q=` để giữ lại từ khoá trong ô sau khi trang kết quả
 * tải xong. Header nằm trong layout, mà layout của App Router không nhận `searchParams`, nên
 * không có cách nào lấy giá trị đó ở phía server. Ô rỗng sau khi vừa tìm xong là lỗi UX thật:
 * người dùng không sửa được từ khoá, phải gõ lại từ đầu.
 *
 * `key` gán theo từ khoá để React dựng lại input mỗi lần điều hướng — `defaultValue` không tự
 * cập nhật khi component chỉ render lại.
 */
export function SearchBox() {
  const query = useSearchParams().get('q') ?? '';

  return (
    <form className={styles.search} role="search" action="/events">
      <span className={styles.searchIcon} aria-hidden="true">
        ⌕
      </span>
      <input
        key={query}
        className={styles.searchInput}
        type="search"
        name="q"
        defaultValue={query}
        placeholder="Tìm sự kiện, nghệ sĩ, địa điểm…"
        aria-label="Tìm sự kiện"
      />
    </form>
  );
}
