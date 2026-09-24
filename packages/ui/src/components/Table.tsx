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
  /**
   * Bấm tiêu đề cột để sắp xếp. Chỉ có tác dụng khi `Table` nhận `sort` và `onSortChange` —
   * component không tự sắp xếp dữ liệu.
   */
  sortable?: boolean;
}

export interface TableSort {
  key: string;
  descending: boolean;
}

export interface TableProps<Row> {
  caption: string;
  columns: Array<TableColumn<Row>>;
  rows: Row[];
  rowKey: (row: Row) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: ReactNode;
  /**
   * Bấm cả dòng. Là **tiện ích cho chuột**, không phải đường đi duy nhất: `<tr>` không nhận focus
   * bàn phím, nên mỗi dòng vẫn phải có một liên kết thật trong ô thao tác. Gắn `tabIndex` cho
   * `<tr>` thì mỗi dòng thành hai điểm dừng Tab chồng lên nhau — tệ hơn là không có.
   */
  onRowClick?: (row: Row) => void;
  /** Cột đang sắp và chiều. Việc sắp xếp do nơi dùng làm (thường trên URL). */
  sort?: TableSort;
  onSortChange?: (key: string) => void;
  className?: string;
}

const SKELETON_ROWS = 5;

/**
 * Bảng dữ liệu.
 *
 * Chỉ lo phần hiển thị: lọc và phân trang do nơi dùng quyết định. Riêng **sắp xếp** thì component
 * lo phần giao diện (nút trong tiêu đề, `aria-sort`, mũi tên) còn phép so sánh vẫn ở ngoài — trạng
 * thái sắp xếp của hai app quản trị sống trên URL để dán được cho người khác.
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
  sort,
  onSortChange,
  className,
}: TableProps<Row>) {
  return (
    <div className={cx(styles.scroll, className)}>
      <table className={styles.table} aria-busy={loading || undefined}>
        <caption className={styles.caption}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => {
              const sortable = column.sortable && onSortChange;
              const active = sortable && sort?.key === column.key;

              return (
                <th
                  key={column.key}
                  scope="col"
                  className={cx(styles.th, column.numeric && styles.numeric)}
                  style={column.width ? { width: column.width } : undefined}
                  // `aria-sort` phải nằm ở `<th>` — đó là nơi trình đọc màn hình tìm nó. Đặt trên
                  // nút bên trong thì nó bị bỏ qua hoàn toàn.
                  aria-sort={
                    sortable
                      ? active
                        ? sort.descending
                          ? 'descending'
                          : 'ascending'
                        : 'none'
                      : undefined
                  }
                >
                  {sortable ? (
                    <button
                      type="button"
                      className={cx(styles.sortButton, active && styles.sortButtonActive)}
                      onClick={() => onSortChange(column.key)}
                    >
                      {column.header}
                      <span aria-hidden="true" className={styles.sortArrow}>
                        {active && sort.descending ? '↓' : '↑'}
                      </span>
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
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
