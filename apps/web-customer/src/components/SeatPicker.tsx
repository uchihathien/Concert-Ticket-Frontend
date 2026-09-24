'use client';

import {
  ApiError,
  placeOrder,
  useApiClient,
  useIdempotencyKey,
  usePlaceHold,
  usePublicFloorPlan,
  useSeatMap,
  type Seat,
  type StandingLine,
  type StandingZone,
} from '@nexaticket/ts-sdk';
import {
  Button,
  MoneyText,
  SeatMapCanvas,
  Skeleton,
  errorMessage,
  formatNumber,
  formatVnd,
  type SeatMark,
} from '@nexaticket/ui';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ApiErrorState } from './ApiErrorState';
import styles from './booking.module.css';

export interface SeatPickerProps {
  eventSessionId: string;
  /** Khoá của mặt bằng khán phòng. Hình học thuộc địa điểm, mà địa điểm tra theo sự kiện. */
  eventSlug: string;
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
export function SeatPicker({ eventSessionId, eventSlug, eventTitle }: SeatPickerProps) {
  const router = useRouter();
  const client = useApiClient();
  const { data, isPending, isError, error, refetch } = useSeatMap(eventSessionId);
  // Mặt bằng hỏng KHÔNG chặn việc mua vé: nó chỉ quyết định sơ đồ vẽ theo hình khán phòng hay theo
  // lưới. Nên không có `isError` nào ở đây — `floorPlan` rỗng thì rơi về lưới, và khách vẫn mua
  // được vé từ một service đang có vấn đề mà họ không cần biết tới.
  const { data: floorPlan } = usePublicFloorPlan(eventSlug);
  const placeHold = usePlaceHold(eventSessionId);

  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [standing, setStanding] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const holdKey = useIdempotencyKey([selectedSeatIds, standing]);
  const orderKey = useIdempotencyKey([selectedSeatIds, standing]);

  const map = data?.data ?? null;

  const seatedZones = useMemo(() => groupByZone(map?.seats ?? []), [map]);

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

  // `seatCode` là khoá chung giữa catalog (hình học) và inventory (trạng thái). Sơ đồ nối hai
  // nguồn qua nó; `id` chỉ dùng khi gửi lệnh giữ chỗ, vì đó là thứ inventory nhận.
  const seatsByCode = useMemo(
    () => new Map((map?.seats ?? []).map((seat) => [seat.seatCode, seat])),
    [map],
  );

  const seatMarks = useMemo(() => {
    const marks = new Map<string, SeatMark>();
    for (const seat of map?.seats ?? []) {
      marks.set(seat.seatCode, {
        id: seat.id,
        status: seat.status,
        priceVnd: seat.priceVnd,
        ticketTypeName: seat.ticketTypeName,
      });
    }
    return marks;
  }, [map]);

  /**
   * Toạ độ ghế lấy từ sơ đồ tồn kho, không từ mặt bằng.
   *
   * Mặt bằng công khai cố ý không mang ghế — chúng đã nằm ở đây kèm trạng thái còn/hết, và trả
   * lần thứ hai là gửi 5.000 dòng mà không thêm thông tin gì. Ghế thiếu toạ độ (suất publish từ
   * trước khi có hình học) bị bỏ qua, và sơ đồ rơi về lưới bên dưới.
   */
  const seatPositions = useMemo(() => {
    const positions = new Map<string, { x: number; y: number }>();
    for (const seat of map?.seats ?? []) {
      if (seat.posX !== null && seat.posY !== null) {
        positions.set(seat.seatCode, { x: seat.posX, y: seat.posY });
      }
    }
    return positions;
  }, [map]);

  const availableByZone = useMemo(() => {
    const byZone = new Map<string, number>();
    for (const seat of map?.seats ?? []) {
      if (seat.status === 'AVAILABLE') {
        byZone.set(seat.zoneCode, (byZone.get(seat.zoneCode) ?? 0) + 1);
      }
    }
    for (const zone of map?.standingZones ?? []) {
      byZone.set(zone.zoneCode, zone.available);
    }
    return byZone;
  }, [map]);

  const selectedSeatCodes = useMemo(
    () => new Set(selectedSeats.map((seat) => seat.seatCode)),
    [selectedSeats],
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

  function toggleSeatCode(seatCode: string) {
    const seat = seatsByCode.get(seatCode);
    if (seat) toggleSeat(seat);
  }

  function setStandingQuantity(zoneCode: string, quantity: number) {
    setFailure(null);
    setStanding((current) => ({ ...current, [zoneCode]: Math.max(0, quantity) }));
  }

  function clearAll() {
    setFailure(null);
    setSelectedSeatIds([]);
    setStanding({});
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
        <Skeleton height={44} />
        <Skeleton height={320} />
        <Skeleton height={220} />
      </div>
    );
  }

  if (isError || !map) {
    return <ApiErrorState error={error} onRetry={() => void refetch()} />;
  }

  const hasSeated = seatedZones.length > 0;
  const hasTaken = map.seats.some((seat) => seat.status !== 'AVAILABLE');
  const soldOut =
    map.seats.every((s) => s.status !== 'AVAILABLE') &&
    map.standingZones.every((z) => z.available === 0);

  return (
    <div className={styles.layout}>
      <div className={styles.map}>
        {soldOut ? <p className={styles.soldOut}>Suất này đã bán hết.</p> : null}

        {/*
          Khu vé đứng đặt TRƯỚC sơ đồ ghế. Nó chỉ chiếm một hai dòng, còn sơ đồ ghế cao hàng nghìn
          pixel — để vé đứng ở dưới thì hạng vé thường đắt nhất và gần sân khấu nhất lại là thứ
          khách phải cuộn qua 1.600 ô ghế mới thấy.
        */}
        {map.standingZones.length > 0 ? (
          <section className={styles.standingBlock} aria-label="Vé đứng">
            <h2 className={styles.blockTitle}>Vé đứng</h2>
            <p className={styles.blockNote}>
              Khu đứng không đánh số chỗ — chỉ cần chọn số lượng vé.
            </p>
            <div className={styles.zoneList}>
              {map.standingZones.map((zone) => (
                <StandingRow
                  key={zone.zoneCode}
                  zone={zone}
                  quantity={standing[zone.zoneCode] ?? 0}
                  onChange={(next) => setStandingQuantity(zone.zoneCode, next)}
                />
              ))}
            </div>
          </section>
        ) : null}

        {hasSeated ? (
          <section className={styles.seatedBlock} aria-label="Sơ đồ chỗ ngồi">
            <Legend hasTaken={hasTaken} />

            {/*
              Hai cách vẽ cùng một sơ đồ, và cái thứ hai không phải đồ thừa.

              `SeatMapCanvas` vẽ đúng hình khán phòng — khu hình cung quanh sân khấu tròn, hai cánh
              xoay 90° của sân khấu chữ U — và giữ số node DOM ở mức vài trăm dù khán phòng 20.000
              chỗ. Nó cần hai thứ: mặt bằng từ catalog, và toạ độ từng ghế trong sơ đồ tồn kho.

              Thiếu một trong hai thì rơi về lưới. Điều đó xảy ra thật, với những suất đã publish
              TRƯỚC khi có hình học: tồn kho của chúng đã dựng xong và mang toạ độ cũ (chỉ số
              hàng/cột), mà tồn kho thì không dựng lại được nếu không rút sự kiện xuống. Lưới là
              đúng thứ những suất ấy vẫn hiển thị được, và nó cũng là đường bàn phím đi được.
            */}
            {floorPlan && seatPositions.size > 0 ? (
              <SeatMapCanvas
                floorPlan={floorPlan}
                seatMarks={seatMarks}
                seatPositions={seatPositions}
                selectedSeatCodes={selectedSeatCodes}
                onToggleSeat={toggleSeatCode}
                availableByZone={availableByZone}
                label={`Sơ đồ chỗ ngồi ${eventTitle}`}
              />
            ) : (
              <>
                {/*
                  Thanh sân khấu là mốc định hướng, không phải đồ trang trí. Không có nó thì lưới
                  ghế chỉ là một đám ô vuông: khách không biết hàng 1 gần hay xa sân khấu, mà đó
                  chính là câu hỏi duy nhất họ đang cân nhắc khi chọn chỗ.
                */}
                <div className={styles.stage} aria-hidden="true">
                  <span>Sân khấu</span>
                </div>

                <div className={styles.zoneList}>
                  {seatedZones.map(([zoneCode, seats]) => (
                    <SeatedZone
                      key={zoneCode}
                      zoneCode={zoneCode}
                      seats={seats}
                      selected={selectedSeatIds}
                      onToggle={toggleSeat}
                    />
                  ))}
                </div>
              </>
            )}
          </section>
        ) : null}
      </div>

      <aside className={styles.summary} aria-label="Chỗ đã chọn">
        <div className={styles.summaryHead}>
          <h2 className={styles.summaryTitle}>{eventTitle}</h2>
          {unitCount > 0 ? (
            <button type="button" className={styles.clear} onClick={clearAll}>
              Bỏ hết
            </button>
          ) : null}
        </div>

        {/* Dòng đếm gọn thay cho cả danh sách khi màn hẹp — xem `.pickedCount` trong CSS. */}
        {unitCount > 0 ? <p className={styles.pickedCount}>{unitCount} vé đã chọn</p> : null}

        {unitCount === 0 ? (
          <p className={styles.summaryEmpty}>
            {hasSeated ? 'Bấm vào ghế trên sơ đồ để chọn.' : 'Chọn số lượng vé để tiếp tục.'}
          </p>
        ) : (
          <ul className={styles.picked}>
            {selectedSeats.map((seat) => (
              <li key={seat.id} className={styles.pickedItem}>
                <span className={styles.pickedName}>{seatName(seat)}</span>
                <MoneyText amountVnd={seat.priceVnd} />
                {/* Bỏ chọn ngay trong danh sách: bấm lại đúng ô ghế cũ trên một lưới 400 ô là
                    việc khó, nhất là sau khi đã cuộn đi chỗ khác. */}
                <button
                  type="button"
                  className={styles.remove}
                  onClick={() => toggleSeat(seat)}
                  aria-label={`Bỏ chọn ${seatName(seat)}`}
                >
                  ×
                </button>
              </li>
            ))}
            {standingLines.map((line) => {
              const zone = map.standingZones.find((z) => z.zoneCode === line.zoneCode);
              return (
                <li key={line.zoneCode} className={styles.pickedItem}>
                  <span className={styles.pickedName}>
                    {zone?.ticketTypeName ?? line.zoneCode} · {line.quantity} vé
                  </span>
                  <MoneyText amountVnd={(zone?.priceVnd ?? 0) * line.quantity} />
                  <button
                    type="button"
                    className={styles.remove}
                    onClick={() => setStandingQuantity(line.zoneCode, 0)}
                    aria-label={`Bỏ vé đứng khu ${line.zoneCode}`}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className={styles.total}>
          <span>
            Tạm tính
            {unitCount > 0 ? <span className={styles.totalCount}> · {unitCount} vé</span> : null}
          </span>
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

        <div className={styles.action}>
          <Button
            block
            size="lg"
            onClick={() => void submit()}
            disabled={unitCount === 0 || overAllowance || submitting}
            loading={submitting}
          >
            {submitting ? 'Đang giữ chỗ…' : 'Giữ chỗ và thanh toán'}
          </Button>
        </div>

        <p className={styles.note}>
          Chỗ được giữ trong ít phút để bạn hoàn tất thanh toán. Hết thời gian, chỗ sẽ mở lại cho
          người khác.
        </p>
      </aside>
    </div>
  );
}

/**
 * Chú giải trạng thái ghế.
 *
 * Ba ô vuông có chữ, không phải chỉ ba màu: bốn trạng thái ghế phân biệt bằng màu là thứ người mù
 * màu không đọc được, và ô gạch chéo cũng vô nghĩa nếu không ai nói nó nghĩa là gì.
 */
function Legend({ hasTaken }: { hasTaken: boolean }) {
  return (
    <ul className={styles.legend}>
      <li>
        <span className={styles.swatch} data-state="available" aria-hidden="true" />
        Còn trống
      </li>
      <li>
        <span className={styles.swatch} data-state="selected" aria-hidden="true" />
        Bạn đang chọn
      </li>
      {hasTaken ? (
        <li>
          <span className={styles.swatch} data-state="taken" aria-hidden="true" />
          Đã có người mua
        </li>
      ) : null}
    </ul>
  );
}

/** Một khu ghế: tên khu, giá, và lưới ghế. */
function SeatedZone({
  zoneCode,
  seats,
  selected,
  onToggle,
}: {
  zoneCode: string;
  seats: Seat[];
  selected: string[];
  onToggle: (seat: Seat) => void;
}) {
  const available = seats.filter((seat) => seat.status === 'AVAILABLE').length;
  const pickedHere = seats.filter((seat) => selected.includes(seat.id)).length;

  return (
    <section className={styles.zone} data-picked={pickedHere > 0 ? 'true' : undefined}>
      <header className={styles.zoneHead}>
        <div>
          <h3 className={styles.zoneName}>{seats[0]?.sectionLabel ?? zoneCode}</h3>
          <p className={styles.zoneMeta}>
            {available > 0 ? `Còn ${formatNumber(available)} ghế` : 'Hết ghế'}
            {pickedHere > 0 ? ` · đang chọn ${pickedHere}` : ''}
          </p>
        </div>
        <span className={styles.zonePrice}>{formatVnd(seats[0]?.priceVnd ?? 0)}</span>
      </header>

      <SeatGrid seats={seats} selected={selected} onToggle={onToggle} />
    </section>
  );
}

/** Một khu vé đứng: giá, số còn lại, và bộ đếm số lượng. */
function StandingRow({
  zone,
  quantity,
  onChange,
}: {
  zone: StandingZone;
  quantity: number;
  onChange: (next: number) => void;
}) {
  return (
    <section className={styles.zone} data-picked={quantity > 0 ? 'true' : undefined}>
      <header className={styles.zoneHead}>
        <div>
          <h3 className={styles.zoneName}>{zone.ticketTypeName ?? zone.zoneCode}</h3>
          <p className={styles.zoneMeta}>
            {zone.available > 0 ? `Còn ${formatNumber(zone.available)} chỗ` : 'Hết chỗ'}
          </p>
        </div>
        <span className={styles.zonePrice}>{formatVnd(zone.priceVnd)}</span>
      </header>

      <div className={styles.quantity}>
        <button
          type="button"
          className={styles.quantityButton}
          onClick={() => onChange(quantity - 1)}
          disabled={quantity === 0}
          aria-label={`Bớt một vé ${zone.zoneCode}`}
        >
          −
        </button>
        <span className={styles.quantityValue} aria-live="polite">
          {quantity}
        </span>
        <button
          type="button"
          className={styles.quantityButton}
          onClick={() => onChange(quantity + 1)}
          // Chặn theo số còn lại: gửi lên một con số chắc chắn bị từ chối chỉ để nhận lỗi.
          disabled={quantity >= zone.available}
          aria-label={`Thêm một vé ${zone.zoneCode}`}
        >
          +
        </button>
        {quantity > 0 ? (
          <span className={styles.quantitySubtotal}>= {formatVnd(zone.priceVnd * quantity)}</span>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Lưới ghế.
 *
 * Ghế được đặt vào **đúng cột theo số ghế**, không phải xếp lần lượt cạnh nhau. Bản trước dùng
 * flex nên hàng nào thiếu ghế thì cả hàng dồn sang trái: nhìn vào thấy các số nhảy loạn và lưới
 * trông như bị hỏng, trong khi dữ liệu hoàn toàn đúng. Ghế thiếu bây giờ để trống đúng chỗ, giống
 * một sơ đồ chỗ thật — và cũng là thông tin có ích, vì lối đi giữa hàng chính là những ô trống đó.
 *
 * Số ghế không phải số (ví dụ `A12`) thì rơi về xếp lần lượt — thà thẳng hàng theo thứ tự còn hơn
 * đoán sai vị trí.
 */
function SeatGrid({
  seats,
  selected,
  onToggle,
}: {
  seats: Seat[];
  selected: string[];
  onToggle: (seat: Seat) => void;
}) {
  const { rows, columnCount } = useMemo(() => buildGrid(seats), [seats]);

  return (
    <div className={styles.gridScroll}>
      <div className={styles.grid} style={{ '--seat-columns': columnCount } as React.CSSProperties}>
        {rows.map((row) => (
          <div key={row.label} className={styles.row}>
            <span className={styles.rowLabel} aria-hidden="true">
              {row.label}
            </span>
            <div className={styles.rowSeats}>
              {row.seats.map(({ seat, column }) => {
                const isSelected = selected.includes(seat.id);
                const available = seat.status === 'AVAILABLE';
                return (
                  <button
                    key={seat.id}
                    type="button"
                    className={styles.seat}
                    style={{ gridColumn: column }}
                    data-state={isSelected ? 'selected' : available ? 'available' : 'taken'}
                    onClick={() => onToggle(seat)}
                    disabled={!available}
                    // Ghế đã bán vẫn nằm trong DOM để giữ đúng hình dạng hàng ghế, nhưng trình
                    // đọc màn hình không cần nghe qua từng cái một.
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
          </div>
        ))}
      </div>
    </div>
  );
}

interface GridRow {
  label: string;
  seats: Array<{ seat: Seat; column: number }>;
}

function buildGrid(seats: Seat[]): { rows: GridRow[]; columnCount: number } {
  const byRow = new Map<string, Seat[]>();
  for (const seat of seats) {
    const key = seat.rowLabel ?? '';
    const list = byRow.get(key) ?? [];
    list.push(seat);
    byRow.set(key, list);
  }

  // Tập số ghế của CẢ khu, để mọi hàng dùng chung một hệ cột.
  const numbers = new Set<number>();
  let allNumeric = true;
  for (const seat of seats) {
    const parsed = Number(seat.seatLabel);
    if (seat.seatLabel === null || Number.isNaN(parsed)) {
      allNumeric = false;
      break;
    }
    numbers.add(parsed);
  }

  const columnOf = new Map<number, number>();
  if (allNumeric) {
    [...numbers].sort((a, b) => a - b).forEach((value, index) => columnOf.set(value, index + 1));
  }

  const rows: GridRow[] = [...byRow.entries()]
    .sort((a, b) => compareRowLabel(a[0], b[0]))
    .map(([label, rowSeats]) => {
      const ordered = [...rowSeats].sort((a, b) => (a.posX ?? 0) - (b.posX ?? 0));
      return {
        label,
        seats: ordered.map((seat, index) => ({
          seat,
          column: allNumeric ? (columnOf.get(Number(seat.seatLabel)) ?? index + 1) : index + 1,
        })),
      };
    });

  const columnCount = allNumeric
    ? Math.max(1, columnOf.size)
    : Math.max(1, ...rows.map((r) => r.seats.length));
  return { rows, columnCount };
}

/** Hàng ghế thường là số; nếu không thì so sánh chữ theo tiếng Việt. */
function compareRowLabel(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return a.localeCompare(b, 'vi');
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
 * Câu cho người dùng lấy từ TỪ ĐIỂN LỖI, không lấy từ `ApiError.detail`.
 *
 * Bản trước đọc thẳng `detail` với giả định "backend đã trả tiếng Việt sẵn". Giả định đó ngược với
 * quy ước của chính hệ thống — `ui/errors.ts` mở đầu bằng: *backend trả `detail` bằng tiếng Anh để
 * ghi log; câu chữ cho người dùng nằm ở đây*. Hậu quả nhìn thấy trên màn hình thật: một khách Việt
 * bấm giữ chỗ và nhận về **"Sales window is closed"**.
 *
 * `errorMessage` còn chèn được số liệu từ `meta` — "còn được mua 2 vé" thay vì một câu chung chung.
 */
function messageOf(error: unknown): string {
  if (error instanceof ApiError) {
    return errorMessage(error);
  }
  return 'Không giữ được chỗ vừa chọn. Sơ đồ đã được làm mới, mời bạn chọn lại.';
}
