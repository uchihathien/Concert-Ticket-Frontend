import type { ReactNode } from 'react';
import { cx } from '../cx';
import { EmptyState } from './EmptyState';
import { Skeleton } from './Skeleton';
import styles from './table.module.css';

export interface TableColumn<Row> {
  key: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  /** Cột số: canh phải, chữ số đều nhau. Cột tiền luôn dùng cái này. */
  numeric?: boolean;
  width?: string;
}

export interface TableProps<Row> {
  caption: string;
  columns: Array<TableColumn<Row>>;
  rows: Row[];
  rowKey: (row: Row) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: ReactNode;
  onRowClick?: (row: Row) => void;
  className?: string;
}

const SKELETON_ROWS = 5;

/**
 * Bảng dữ liệu.
 *
 * Chỉ lo phần hiển thị: sắp xếp, lọc, phân trang do nơi dùng quyết định (web-platform dùng
 * TanStack Table và giữ trạng thái trên URL). Trộn hai việc vào một component là cách chắc chắn
 * nhất để không tái dùng được ở màn thứ hai.
 */
export function Table<Row>({
  caption,
  columns,
  rows,
  rowKey,
  loading = false,
  emptyTitle = 'Chưa có dữ liệu',
  emptyDescription,
  onRowClick,
  className,
}: TableProps<Row>) {
  return (
    <div className={cx(styles.scroll, className)}>
      <table className={styles.table} aria-busy={loading || undefined}>
        <caption className={styles.caption}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cx(styles.th, column.numeric && styles.numeric)}
                style={column.width ? { width: column.width } : undefined}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
                <tr key={`skeleton-${index}`} className={styles.row}>
                  {columns.map((column) => (
                    <td key={column.key} className={styles.td}>
                      <Skeleton />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className={cx(styles.row, onRowClick && styles.rowClickable)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cx(styles.td, column.numeric && styles.numeric)}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
          {!loading && rows.length === 0 ? (
            <tr>
              <td className={styles.stateCell} colSpan={columns.length}>
                <EmptyState title={emptyTitle} description={emptyDescription} />
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
