import { Skeleton } from '@nexaticket/ui';
import { BookingSteps } from '@/components/BookingSteps';
import styles from './booking-page.module.css';

/**
 * Màn chờ của trang chọn chỗ.
 *
 * <h3>Lỗ hổng này nằm ở phía server, không phải phía trình duyệt</h3>
 *
 * `SeatPicker` đã có khối chờ riêng cho lần tải sơ đồ ghế của nó. Nhưng trang là một server
 * component `async`: nó phải tra xong tên sự kiện trước khi dựng được bất cứ gì. Không có file
 * này thì trong suốt nhịp ấy router **giữ nguyên trang cũ** — khách bấm "Chọn chỗ" và màn hình
 * không đổi gì. Ở một đợt mở bán, phản ứng tự nhiên là bấm thêm lần nữa.
 *
 * <h3>Stepper là thật, không phải khối xám</h3>
 *
 * `BookingSteps` không cần dữ liệu nào nên dựng được ngay. Hiện nó thật khiến khách thấy mình đã
 * ở bước 1 của luồng đặt vé — một câu trả lời đúng cho câu hỏi "có ăn không?", đúng lúc họ đang
 * hỏi nó.
 */
export default function BookingLoading() {
  return (
    <main className={styles.page} aria-busy="true">
      <nav className={styles.breadcrumb} aria-label="Đường dẫn">
        <Skeleton height={14} width="28ch" />
      </nav>

      <BookingSteps current="seats" />

      <header className={styles.header}>
        <h1 className={styles.title}>
          <Skeleton height={30} width="20ch" />
        </h1>
        <p className={styles.meta}>
          <Skeleton height={14} width="36ch" />
        </p>
      </header>

      {/* Ba khối dưới khớp đúng khối chờ bên trong SeatPicker (thanh chú thích, sơ đồ, danh sách
          khu), nên lúc server xong việc và client bắt đầu tải sơ đồ, màn hình không đổi hình dạng
          — chỉ là cùng một khung chờ đi tiếp. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--nt-space-4)' }}>
        <Skeleton height={44} />
        <Skeleton height={320} />
        <Skeleton height={220} />
      </div>
    </main>
  );
}
