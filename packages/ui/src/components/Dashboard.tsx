import type { ReactNode } from 'react';
import { Panel } from './AppShell';
import { Button } from './Button';
import { Skeleton } from './Skeleton';
import { cx } from '../cx';
import { formatNumber } from '../format';
import styles from './dashboard.module.css';

/* ---------------------------------------------------------------------------
 * Bốn khối lặp lại ở mọi màn quản trị.
 *
 * Chúng ở `packages/ui` chứ không ở từng app vì `web-admin` và `web-platform` là hai persona khác
 * nhau nhưng cùng một kiểu làm việc — nhiều bảng, ít đồ hoạ. Trước đây mỗi trang tự dựng lại bằng
 * `style={{ ... }}`, nên không trang nào có điểm ngắt responsive và mỗi bản lệch nhau vài pixel.
 * ------------------------------------------------------------------------- */

export interface StatCardProps {
  label: string;
  /** Số đã đếm, hoặc `null` khi đang tải — component tự vẽ khối chờ. */
  value: number | null;
  /** Chú thích nhỏ dưới số, ví dụ phạm vi của phép đếm. */
  hint?: ReactNode;
  /** `warn` khi con số này là thứ cần xử lý chứ không phải để biết (ví dụ: tổ chức đang khoá). */
  tone?: 'default' | 'warn';
  icon?: ReactNode;
}

/**
 * Một ô số ở đầu trang.
 *
 * Nhận `value: number | null` chứ không nhận `loading` riêng: hai nguồn sự thật cho cùng một
 * trạng thái là hai chỗ để lệch nhau, và bản đã lệch sẽ hiện số 0 trong lúc dữ liệu chưa về —
 * "không có tổ chức nào" và "chưa biết có bao nhiêu" là hai câu khác hẳn nhau.
 */
export function StatCard({ label, value, hint, tone = 'default', icon }: StatCardProps) {
  return (
    <Panel>
      <p className={styles.statLabel}>
        {icon}
        {label}
      </p>
      {value === null ? (
        <div style={{ marginTop: 6 }}>
          <Skeleton width="40%" height={24} />
        </div>
      ) : (
        <p className={cx(styles.statValue, tone === 'warn' && styles.statValueWarn)}>
          {formatNumber(value)}
        </p>
      )}
      {hint ? <p className={styles.statHint}>{hint}</p> : null}
    </Panel>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className={styles.statGrid}>{children}</div>;
}

export interface FilterBarProps {
  /** Các ô lọc: `Input`, `Select`… Chúng tự xếp theo lưới responsive. */
  children: ReactNode;
  /** Nút "Xoá bộ lọc" và tương tự. Luôn nằm cuối hàng. */
  actions?: ReactNode;
  /**
   * Dòng đếm kết quả. Đọc bằng `aria-live` nên người dùng trình đọc màn hình biết bộ lọc vừa cắt
   * còn bao nhiêu dòng — nếu không, với họ thao tác lọc không tạo ra phản hồi nào.
   */
  count?: ReactNode;
}

export function FilterBar({ children, actions, count }: FilterBarProps) {
  return (
    <Panel>
      <div className={styles.filterBar}>
        {children}
        {actions ? <div className={styles.filterActions}>{actions}</div> : null}
      </div>
      {count ? (
        <p className={styles.filterCount} aria-live="polite">
          {count}
        </p>
      ) : null}
    </Panel>
  );
}

export interface PaginationProps {
  /** Trang hiện tại tính từ 0 — khớp với `offset / limit` mà backend nhận. */
  page: number;
  /** Số dòng trang này trả về. Bằng `pageSize` nghĩa là "có thể còn nữa". */
  received: number;
  pageSize: number;
  onChange: (page: number) => void;
  label?: ReactNode;
}

/**
 * Lùi/tiến một trang.
 *
 * Không có "trang cuối" và không hiện tổng số trang: backend **không trả tổng số dòng**. Suy ra
 * được đúng một điều — trang đầy nghĩa là có thể còn nữa — và đoán thêm thì sẽ hiện một nút dẫn
 * tới trang trống.
 */
export function Pagination({ page, received, pageSize, onChange, label }: PaginationProps) {
  return (
    <nav className={styles.pagination} aria-label="Phân trang">
      {label ? <span className={styles.paginationLabel}>{label}</span> : null}
      <Button variant="secondary" disabled={page === 0} onClick={() => onChange(page - 1)}>
        Trang trước
      </Button>
      <Button variant="secondary" disabled={received < pageSize} onClick={() => onChange(page + 1)}>
        Trang sau
      </Button>
    </nav>
  );
}

export interface SectionProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Một khối trong trang, có tiêu đề riêng.
 *
 * Tiêu đề là `<h2>` chứ không phải `PageHeader` (vốn dựng `<h1>`): mỗi trang chỉ được có một
 * `<h1>`, và một trang bốn `<h1>` thì với trình đọc màn hình nó là bốn trang chồng lên nhau.
 */
export function Section({ title, description, actions, children }: SectionProps) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <div>
          <h2 className={styles.sectionTitle}>{title}</h2>
          {description ? <p className={styles.sectionDescription}>{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** Hàng nút trong một ô của bảng. Xuống hàng được — trên màn hẹp bốn nút không nằm vừa một dòng. */
export function RowActions({ children }: { children: ReactNode }) {
  return <div className={styles.rowActions}>{children}</div>;
}
