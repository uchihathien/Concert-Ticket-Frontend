'use client';

import {
  ApiError,
  placeOrder,
  useApiClient,
  useIdempotencyKey,
  usePlaceHold,
  useSeatMap,
  type Seat,
  type StandingLine,
} from '@nexaticket/ts-sdk';
import { Button, ErrorState, MoneyText, Skeleton, formatVnd } from '@nexaticket/ui';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import styles from './booking.module.css';

export interface SeatPickerProps {
  eventSessionId: string;
  eventTitle: string;
}

/**
 * Chọn chỗ, giữ chỗ, rồi đặt đơn.
 *
 * <h3>Vì sao ba bước gộp vào một nút</h3>
 *
 * Giữ chỗ và đặt đơn là hai lời gọi API, nhưng với khách chúng là một hành động: "tôi lấy mấy ghế
 * này". Tách thành hai nút sẽ tạo ra một trạng thái không ai muốn ở giữa — đã giữ chỗ nhưng chưa
 * có đơn — và chỗ đó sẽ hết hạn trong im lặng nếu khách phân vân.
 *
 * <h3>Hai khoá idempotency, không phải một</h3>
 *
 * Mỗi lời gọi có khoá riêng, cùng gắn với LỰA CHỌN hiện tại. Dùng chung một khoá cho cả hai là
 * sai: chúng đi tới hai service khác nhau với hai bảng idempotency khác nhau, và nếu bước hai hỏng
 * phải thử lại thì bước một không được coi là "đã làm rồi" theo khoá của bước hai.
 *
 * Khoá đổi khi lựa chọn đổi — đó là lý do `useIdempotencyKey` nhận danh sách phụ thuộc. Giữ nguyên
 * khoá qua các lựa chọn khác nhau thì lần bấm thứ hai sẽ nhận lại kết quả của lần thứ nhất, tức là
 * khách trả tiền cho những ghế mình đã bỏ chọn.
 */
export function SeatPicker({ eventSessionId, eventTitle }: SeatPickerProps) {
  const router = useRouter();
  const client = useApiClient();
  const { data, isPending, isError, error, refetch } = useSeatMap(eventSessionId);
  const placeHold = usePlaceHold(eventSessionId);

  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [standing, setStanding] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const holdKey = useIdempotencyKey([selectedSeatIds, standing]);
  const orderKey = useIdempotencyKey([selectedSeatIds, standing]);

  const map = data?.data ?? null;

  const seatsByZone = useMemo(() => groupByZone(map?.seats ?? []), [map]);

  const standingLines: StandingLine[] = useMemo(
    () =>
      Object.entries(standing)
        .filter(([, quantity]) => quantity > 0)
        .map(([zoneCode, quantity]) => ({ zoneCode, quantity })),
    [standing],
  );

  const selectedSeats = useMemo(
    () => (map?.seats ?? []).filter((seat) => selectedSeatIds.includes(seat.id)),
    [map, selectedSeatIds],
  );

  const unitCount =
    selectedSeats.length + standingLines.reduce((sum, line) => sum + line.quantity, 0);

  const total =
    selectedSeats.reduce((sum, seat) => sum + seat.priceVnd, 0) +
    standingLines.reduce((sum, line) => {
      const zone = map?.standingZones.find((z) => z.zoneCode === line.zoneCode);
      return sum + (zone?.priceVnd ?? 0) * line.quantity;
    }, 0);

  // Trần mua do backend tính và trả về, không phải hằng số ở đây: nó là kết quả của chuỗi kế thừa
  // suất diễn → tổ chức → nền tảng, và còn trừ đi số vé người này đã mua ở những lần trước.
  const allowance = map?.purchaseAllowance ?? null;
  const overAllowance = allowance !== null && unitCount > allowance.remaining;

  function toggleSeat(seat: Seat) {
    if (seat.status !== 'AVAILABLE') return;
    setFailure(null);
    setSelectedSeatIds((current) =>
      current.includes(seat.id) ? current.filter((id) => id !== seat.id) : [...current, seat.id],
    );
  }

  function setStandingQuantity(zoneCode: string, quantity: number) {
    setFailure(null);
    setStanding((current) => ({ ...current, [zoneCode]: Math.max(0, quantity) }));
  }

  async function submit() {
    if (unitCount === 0 || submitting) return;
    setSubmitting(true);
    setFailure(null);

    try {
      const hold = await placeHold.mutateAsync({
        seatIds: selectedSeatIds.length > 0 ? selectedSeatIds : undefined,
        standing: standingLines.length > 0 ? standingLines : undefined,
        idempotencyKey: holdKey.getKey(),
      });

      const order = await placeOrder(client, { holdId: hold.holdId }, orderKey.getKey());

      // `replace` chứ không `push`: quay lại trang chọn chỗ sau khi đã có đơn là quay về một sơ đồ
      // mà những ghế vừa chọn đã mang trạng thái HELD — bấm tiếp vào chúng chỉ nhận lỗi.
      router.replace(`/orders/${order.orderId}/pay`);
    } catch (error) {
      // Giữ chỗ hỏng gần như luôn vì người khác vừa lấy mất ghế, hoặc vì chạm trần mua. Cả hai đều
      // cần sơ đồ mới: giữ nguyên màn hình cũ thì khách bấm lại đúng cái ghế đã mất.
      setFailure(messageOf(error));
      setSelectedSeatIds([]);
      setStanding({});
      void refetch();
      setSubmitting(false);
    }
  }

  if (isPending) {
    return (
      <div className={styles.loading} aria-busy="true">
        <Skeleton height={28} width="40%" />
        <Skeleton height={180} />
        <Skeleton height={180} />
      </div>
    );
  }

  if (isError || !map) {
    const apiError = error instanceof ApiError ? error : null;
    return (
      // Truyền chính đối tượng lỗi: ErrorState tự tra câu tiếng Việt theo mã lỗi và hiện
      // correlation id — thứ duy nhất nối màn hình này với log phía server.
      <ErrorState
        error={apiError}
        correlationId={apiError?.correlationId ?? null}
        onRetry={() => void refetch()}
      />
    );
  }

  const soldOut =
    map.seats.every((s) => s.status !== 'AVAILABLE') &&
    map.standingZones.every((z) => z.available === 0);

  return (
    <div className={styles.layout}>
      <div className={styles.zones}>
        {soldOut ? <p className={styles.soldOut}>Suất này đã bán hết.</p> : null}

        {map.standingZones.map((zone) => {
          const picked = standing[zone.zoneCode] ?? 0;
          return (
            <section key={zone.zoneCode} className={styles.zone}>
              <header className={styles.zoneHead}>
                <h2 className={styles.zoneName}>{zone.ticketTypeName ?? zone.zoneCode}</h2>
                <span className={styles.zonePrice}>{formatVnd(zone.priceVnd)}</span>
              </header>
              <p className={styles.zoneMeta}>
                Vé đứng · còn {zone.available.toLocaleString('vi-VN')} chỗ
              </p>
              {/* Vé đứng không có ghế để bấm — chỉ chọn số lượng. Vẫn giới hạn theo số còn lại để
                  khách không gửi lên một con số chắc chắn bị từ chối. */}
              <div className={styles.quantity}>
                <button
                  type="button"
                  className={styles.quantityButton}
                  onClick={() => setStandingQuantity(zone.zoneCode, picked - 1)}
                  disabled={picked === 0}
                  aria-label={`Bớt một vé ${zone.zoneCode}`}
                >
                  −
                </button>
                <span className={styles.quantityValue} aria-live="polite">
                  {picked}
                </span>
                <button
                  type="button"
                  className={styles.quantityButton}
                  onClick={() => setStandingQuantity(zone.zoneCode, picked + 1)}
                  disabled={picked >= zone.available}
                  aria-label={`Thêm một vé ${zone.zoneCode}`}
                >
                  +
                </button>
              </div>
            </section>
          );
        })}

        {seatsByZone.map(([zoneCode, seats]) => (
          <section key={zoneCode} className={styles.zone}>
            <header className={styles.zoneHead}>
              <h2 className={styles.zoneName}>{seats[0]?.sectionLabel ?? zoneCode}</h2>
              <span className={styles.zonePrice}>{formatVnd(seats[0]?.priceVnd ?? 0)}</span>
            </header>
            <SeatGrid seats={seats} selected={selectedSeatIds} onToggle={toggleSeat} />
          </section>
        ))}
      </div>

      <aside className={styles.summary}>
        <h2 className={styles.summaryTitle}>{eventTitle}</h2>

        {unitCount === 0 ? (
          <p className={styles.summaryEmpty}>Chọn chỗ để tiếp tục.</p>
        ) : (
          <ul className={styles.picked}>
            {selectedSeats.map((seat) => (
              <li key={seat.id}>
                <span>{seatName(seat)}</span>
                <MoneyText amountVnd={seat.priceVnd} />
              </li>
            ))}
            {standingLines.map((line) => (
              <li key={line.zoneCode}>
                <span>
                  {line.zoneCode} · {line.quantity} vé đứng
                </span>
                <MoneyText
                  amountVnd={
                    (map.standingZones.find((z) => z.zoneCode === line.zoneCode)?.priceVnd ?? 0) *
                    line.quantity
                  }
                />
              </li>
            ))}
          </ul>
        )}

        <div className={styles.total}>
          <span>Tạm tính</span>
          <MoneyText amountVnd={total} strong />
        </div>

        {allowance !== null ? (
          <p className={styles.allowance}>
            Bạn còn mua được {allowance.remaining} vé cho suất này
            {allowance.used > 0 ? ` (đã mua ${allowance.used})` : ''}.
          </p>
        ) : null}

        {overAllowance ? (
          <p className={styles.failure} role="alert">
            Vượt quá số vé được mua cho suất này.
          </p>
        ) : null}

        {failure ? (
          <p className={styles.failure} role="alert">
            {failure}
          </p>
        ) : null}

        <Button
          block
          size="lg"
          onClick={() => void submit()}
          disabled={unitCount === 0 || overAllowance || submitting}
          loading={submitting}
        >
          {submitting ? 'Đang giữ chỗ…' : 'Giữ chỗ và thanh toán'}
        </Button>

        <p className={styles.note}>
          Chỗ được giữ trong ít phút để bạn hoàn tất thanh toán. Hết thời gian, chỗ sẽ mở lại cho
          người khác.
        </p>
      </aside>
    </div>
  );
}

/** Lưới ghế theo hàng. Hàng lấy từ `rowLabel` của backend, không tự suy từ toạ độ. */
function SeatGrid({
  seats,
  selected,
  onToggle,
}: {
  seats: Seat[];
  selected: string[];
  onToggle: (seat: Seat) => void;
}) {
  const rows = useMemo(() => {
    const grouped = new Map<string, Seat[]>();
    for (const seat of seats) {
      const key = seat.rowLabel ?? '';
      const list = grouped.get(key) ?? [];
      list.push(seat);
      grouped.set(key, list);
    }
    for (const list of grouped.values()) {
      list.sort((a, b) => (a.posX ?? 0) - (b.posX ?? 0));
    }
    return [...grouped.entries()].sort((a, b) => Number(a[0]) - Number(b[0]));
  }, [seats]);

  return (
    <div className={styles.grid}>
      {rows.map(([rowLabel, rowSeats]) => (
        <div key={rowLabel} className={styles.row}>
          <span className={styles.rowLabel} aria-hidden="true">
            {rowLabel}
          </span>
          {rowSeats.map((seat) => {
            const isSelected = selected.includes(seat.id);
            const available = seat.status === 'AVAILABLE';
            return (
              <button
                key={seat.id}
                type="button"
                className={styles.seat}
                data-state={isSelected ? 'selected' : available ? 'available' : 'taken'}
                onClick={() => onToggle(seat)}
                disabled={!available}
                // Ghế đã bán vẫn nằm trong DOM để giữ đúng hình dạng hàng ghế, nhưng trình đọc
                // màn hình không cần nghe qua từng cái một.
                aria-hidden={available ? undefined : true}
                tabIndex={available ? undefined : -1}
                aria-pressed={isSelected}
                aria-label={`Ghế ${seatName(seat)}, ${formatVnd(seat.priceVnd)}`}
              >
                {seat.seatLabel ?? ''}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function groupByZone(seats: Seat[]): Array<[string, Seat[]]> {
  const grouped = new Map<string, Seat[]>();
  for (const seat of seats) {
    const list = grouped.get(seat.zoneCode) ?? [];
    list.push(seat);
    grouped.set(seat.zoneCode, list);
  }
  return [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0], 'vi'));
}

function seatName(seat: Seat): string {
  const row = seat.rowLabel ? `hàng ${seat.rowLabel}` : null;
  const number = seat.seatLabel ? `ghế ${seat.seatLabel}` : null;
  return [seat.sectionLabel, row, number].filter(Boolean).join(' · ') || seat.seatCode;
}

/**
 * Lỗi từ backend đã có câu tiếng Việt sẵn ở `ApiError.detail`; chỉ khi không có mới rơi về câu
 * chung. Hiện "Error: Request failed" cho một người vừa mất ghế là vô ích.
 */
function messageOf(error: unknown): string {
  if (error && typeof error === 'object' && 'detail' in error) {
    const detail = (error as { detail?: unknown }).detail;
    if (typeof detail === 'string' && detail.length > 0) return detail;
  }
  return 'Không giữ được chỗ vừa chọn. Sơ đồ đã được làm mới, mời bạn chọn lại.';
}
