'use client';

import { useId, useState } from 'react';
import { cx } from '../cx';
import styles from './bar-chart.module.css';

export interface BarChartRow {
  /** Khoá React, và cũng là thứ phân biệt hai dòng cùng nhãn. */
  key: string;
  label: string;
  value: number;
  /** Dòng phụ trong chú giải khi trỏ vào, ví dụ "120 / 400 chỗ". */
  hint?: string;
}

export interface BarChartProps {
  rows: BarChartRow[];
  /** Tiêu đề của hình. Với một chuỗi dữ liệu thì đây LÀ chú giải — không có hộp legend. */
  caption: string;
  /** Đổi số thành chữ người đọc được (tiền, phần trăm, số đếm). */
  format: (value: number) => string;
  /**
   * Mốc 100% của thanh dài nhất. Bỏ trống thì lấy giá trị lớn nhất trong `rows`.
   *
   * Khai tường minh khi thang đo có nghĩa tuyệt đối — ví dụ tỷ lệ lấp đầy thì `max={100}`, để một
   * khu bán được 30% trông đúng là 30% chứ không phải "dài nhất trong nhóm".
   */
  max?: number;
  className?: string;
}

/**
 * Thanh ngang, MỘT chuỗi dữ liệu.
 *
 * <h3>Vì sao thanh ngang cho cả hai chỗ, kể cả dữ liệu theo thời gian</h3>
 *
 * Số liệu theo thời gian thường vẽ thành cột dọc. Ở đây nhãn là <b>mốc giờ của suất diễn</b> —
 * "20:00 · 14/06/2026" — và một nhãn dài như thế dưới chân cột dọc buộc phải quay chéo hoặc cắt
 * bớt. Thanh ngang đặt nhãn ở bên trái, đọc thẳng, không quay chữ. Với ba tới mười dòng thì đó là
 * lựa chọn đúng; nhiều mốc thời gian hơn nữa mới đáng đổi sang cột.
 *
 * <h3>Một chuỗi nên KHÔNG có hộp legend</h3>
 *
 * Chỉ có một màu, nên tiêu đề hình đã nói ra thứ đang được vẽ. Một hộp legend một ô màu chỉ nhắc
 * lại tiêu đề và chiếm chỗ.
 *
 * <h3>Giá trị nằm NGOÀI thanh</h3>
 *
 * Không đặt số bên trong thanh: thanh ngắn thì chữ bị cắt, và `overflow: hidden` để "xử lý" việc
 * đó sẽ ăn mất chữ số đầu — tệ hơn là không có nhãn. Đặt ở cột bên phải thì mọi giá trị đều đọc
 * được bất kể thanh dài ngắn, và các số thẳng cột nên so sánh được bằng mắt.
 *
 * <h3>Màu</h3>
 *
 * Một màu duy nhất (`--nt-primary`) cho mọi thanh. KHÔNG tô đậm-nhạt theo giá trị: làm vậy là mã
 * hoá độ dài thanh thêm một lần nữa bằng màu, đốt kênh biểu đạt duy nhất còn trống cho một thông
 * tin mà chart đã nói rồi.
 */
export function BarChart({ rows, caption, format, max, className }: BarChartProps) {
  const captionId = useId();
  const [active, setActive] = useState<string | null>(null);

  // Không chia cho 0, và không để một thang toàn số 0 vẽ ra những thanh dài bằng nhau.
  const ceiling = Math.max(max ?? 0, ...rows.map((row) => row.value), 0) || 1;

  if (rows.length === 0) {
    return null;
  }

  return (
    <figure className={cx(styles.figure, className)} aria-labelledby={captionId}>
      <figcaption className={styles.caption} id={captionId}>
        {caption}
      </figcaption>

      <ul className={styles.rows}>
        {rows.map((row) => {
          const share = Math.max(0, Math.min(1, row.value / ceiling));
          const isActive = active === row.key;

          return (
            <li key={row.key} className={styles.row}>
              <span className={styles.label} title={row.label}>
                {row.label}
              </span>

              {/*
                `tabIndex` để bàn phím tới được: chú giải khi trỏ chuột và khi focus phải giống
                nhau, nếu không người dùng bàn phím mất đúng phần thông tin thêm ấy.
              */}
              <span
                className={styles.track}
                tabIndex={0}
                onMouseEnter={() => setActive(row.key)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(row.key)}
                onBlur={() => setActive(null)}
                aria-label={`${row.label}: ${format(row.value)}${row.hint ? ` (${row.hint})` : ''}`}
              >
                {/* Thanh 0 vẫn vẽ một vạch mảnh: "bằng 0" phải trông khác "không có dòng này". */}
                <span className={styles.fill} style={{ width: `${Math.max(share * 100, 0.6)}%` }} />

                {isActive && row.hint ? (
                  <span className={styles.tip} role="status">
                    {row.hint}
                  </span>
                ) : null}
              </span>

              <span className={styles.value}>{format(row.value)}</span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
