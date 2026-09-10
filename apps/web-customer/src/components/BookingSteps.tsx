import styles from './steps.module.css';

export type BookingStep = 'seats' | 'pay' | 'tickets';

const STEPS: Array<{ id: BookingStep; label: string }> = [
  { id: 'seats', label: 'Chọn chỗ' },
  { id: 'pay', label: 'Thanh toán' },
  { id: 'tickets', label: 'Nhận vé' },
];

/**
 * Thanh ba bước của luồng mua vé.
 *
 * Có mặt vì luồng này trải qua ba trang khác nhau, mỗi trang một địa chỉ, và giữa chúng có một
 * đồng hồ đếm ngược. Không có thanh này thì khách đứng ở trang thanh toán không biết còn mấy bước
 * nữa — và khi có đồng hồ đang chạy thì "không biết còn bao lâu nữa" là lý do người ta bỏ giữa
 * chừng.
 *
 * Bước đã qua đánh dấu `✓`, bước hiện tại tô đậm, bước sau để mờ. Không phải link: nhảy ngược về
 * chọn chỗ khi đã có đơn chỉ dẫn tới một sơ đồ mà ghế của mình đã thành `HELD`.
 */
export function BookingSteps({ current }: { current: BookingStep }) {
  const currentIndex = STEPS.findIndex((step) => step.id === current);

  return (
    <ol className={styles.steps} aria-label="Tiến trình mua vé">
      {STEPS.map((step, index) => {
        const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'todo';
        return (
          <li key={step.id} className={styles.step} data-state={state}>
            <span className={styles.marker} aria-hidden="true">
              {state === 'done' ? '✓' : index + 1}
            </span>
            <span className={styles.label}>{step.label}</span>
            {/* `aria-current` là thứ trình đọc màn hình dùng để báo "đang ở bước này". */}
            {state === 'current' ? <span className={styles.srOnly}>(đang ở đây)</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
