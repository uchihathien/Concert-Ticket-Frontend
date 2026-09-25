'use client';

import {
  floorPlanRect,
  floorPlanViewBox,
  outlinePath,
  type FloorPlan,
  type FloorPlanRect,
  type FloorPlanSeat,
  type FloorPlanZone,
} from '@nexaticket/ts-sdk/floor-plan';
import { useCallback, useMemo, useRef, useState } from 'react';
import { cx } from '../cx';
import styles from './seat-map.module.css';

/**
 * Trạng thái một chỗ, đã rút gọn về đúng thứ sơ đồ cần vẽ.
 *
 * Không nhận thẳng `Seat` của inventory: component này cũng chạy ở màn hình xem trước của ban tổ
 * chức, nơi chưa có tồn kho nào và mọi ghế đều là `AVAILABLE`. Nhận một kiểu hẹp hơn thì cả hai
 * nơi dùng được mà không nơi nào phải dựng một `Seat` giả.
 */
export interface SeatMark {
  id: string;
  status: 'AVAILABLE' | 'HELD' | 'RESERVED' | 'SOLD' | 'BLOCKED';
  priceVnd: number;
  ticketTypeName: string | null;
}

export interface SeatMapCanvasProps {
  floorPlan: FloorPlan;
  /** Trạng thái theo `seatCode`. Thiếu một mã nghĩa là chỗ đó chưa dựng tồn kho — vẽ mờ. */
  seatMarks?: Map<string, SeatMark>;
  /** Toạ độ ghế khi mặt bằng không mang sẵn (đường công khai) — lấy từ sơ đồ tồn kho. */
  seatPositions?: Map<string, { x: number; y: number }>;
  selectedSeatCodes?: ReadonlySet<string>;
  onToggleSeat?: (seatCode: string, mark: SeatMark | undefined) => void;
  /** Số chỗ còn trống theo khu, để nhãn khu nói được "còn 120/500" khi chưa phóng to. */
  availableByZone?: Map<string, number>;
  className?: string;
  /** Nhãn cho trình đọc màn hình; bản đồ là hình, nên nó phải tự mô tả được. */
  label?: string;
}

/** Bán kính ghế, đơn vị mặt bằng. 0,38 để hai ghế cạnh nhau còn một khe nhìn thấy được. */
const SEAT_RADIUS = 0.38;

/** Phóng to hết cỡ. Quá mức này thì một ghế chiếm nửa màn hình và người dùng lạc mất chỗ mình đứng. */
const MAX_ZOOM = 12;

/**
 * Sơ đồ chỗ ngồi vẽ bằng SVG.
 *
 * <h3>Vì sao không phải một nút cho mỗi ghế</h3>
 *
 * Bản cũ render một `<button>` cho mỗi chỗ. Với nhà hát 300 ghế thì không sao; với sân vận động
 * 20.000 chỗ thì đó là 20.000 node DOM cộng 20.000 listener, và trình duyệt đứng hình vài giây
 * ngay lúc mở bán — đúng lúc không được phép đứng.
 *
 * Ba việc thay thế nó, theo thứ tự quan trọng:
 *
 * <ol>
 *   <li><b>Mức chi tiết theo khu.</b> Chưa chọn khu thì chỉ vẽ đường bao khu — vài chục node cho
 *       cả khán phòng. Ghế chỉ xuất hiện trong khu đang mở. Đây là thứ cắt 20.000 xuống còn vài
 *       trăm, và nó cũng đúng với cách người ta chọn chỗ: chọn khu trước, chọn ghế sau.
 *   <li><b>Cắt theo khung nhìn.</b> Trong một khu đang phóng to, chỉ ghế nằm trong khung mới được
 *       vẽ. Kéo và phóng vẫn mượt vì số node không đổi theo kích thước khu.
 *   <li><b>Một listener duy nhất.</b> Bắt sự kiện ở gốc `<svg>` rồi đọc `data-seat-code` của đích.
 *       Gắn handler lên từng ghế là gắn lại toàn bộ sau mỗi lần trạng thái đổi.
 * </ol>
 *
 * <h3>Toạ độ đến từ đâu</h3>
 *
 * Mặt bằng công khai không mang toạ độ ghế — chúng đã nằm trong sơ đồ tồn kho kèm trạng thái
 * còn/hết. Nên `seatPositions` là đường để nơi dùng đưa toạ độ ấy vào; còn ở màn hình quản trị thì
 * `floorPlan.zones[].seats` đã có sẵn và không cần truyền gì. Hai nguồn, một khoá: `seatCode`.
 */
export function SeatMapCanvas({
  floorPlan,
  seatMarks,
  seatPositions,
  selectedSeatCodes,
  onToggleSeat,
  availableByZone,
  className,
  label,
}: SeatMapCanvasProps) {
  const [focusedZone, setFocusedZone] = useState<string | null>(null);
  const [view, setView] = useState<Rect | null>(null);
  const dragRef = useRef<{ x: number; y: number; view: Rect } | null>(null);

  /**
   * Con trỏ bàn phím: mã khu khi đang xem toàn cảnh, mã chỗ khi đã mở một khu.
   *
   * MỘT điểm dừng Tab cho cả sơ đồ, rồi di chuyển bên trong bằng mũi tên — đúng mô hình của một
   * lưới. Cách kia là cho mỗi ghế một `tabIndex`, và nó sai ở hai đầu: một khu 2.000 chỗ thành
   * 2.000 điểm dừng Tab, còn thứ tự Tab thì đổi mỗi lần người dùng kéo sơ đồ (chỉ ghế trong khung
   * nhìn có mặt trong DOM).
   */
  const [cursor, setCursor] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const fullView = useMemo(() => floorPlanRect(floorPlan.bounds), [floorPlan]);
  const current = view ?? fullView;

  const zonesByCode = useMemo(
    () => new Map(floorPlan.zones.map((zone) => [zone.zoneCode, zone])),
    [floorPlan],
  );

  const visibleSeats = useMemo(() => {
    if (!focusedZone) return [];
    const zone = zonesByCode.get(focusedZone);
    if (!zone || zone.kind === 'STANDING') return [];
    return cull(placedSeats(zone, seatPositions), current);
  }, [focusedZone, zonesByCode, seatPositions, current]);

  /**
   * Toàn bộ ghế của khu đang mở, KHÔNG cắt theo khung nhìn.
   *
   * Khác `visibleSeats` ở đúng một điều, và điều đó quan trọng: con trỏ bàn phím phải đi tới được
   * một ghế đang nằm ngoài khung — rồi khung mới dịch theo nó. Dùng danh sách đã cắt thì mũi tên
   * dừng lại ở rìa màn hình và người dùng bàn phím không bao giờ tới được nửa còn lại của khu.
   */
  const zoneSeats = useMemo(() => {
    if (!focusedZone) return [];
    const zone = zonesByCode.get(focusedZone);
    if (!zone || zone.kind === 'STANDING') return [];
    return placedSeats(zone, seatPositions);
  }, [focusedZone, zonesByCode, seatPositions]);

  const openZone = useCallback((zone: FloorPlanZone) => {
    setFocusedZone(zone.zoneCode);
    setView(padded(boundsOf(zone.outline)));
    setCursor(null);
  }, []);

  const reset = useCallback(() => {
    setFocusedZone(null);
    setView(null);
    setCursor(null);
  }, []);

  /** Dịch khung để con trỏ nằm trong tầm nhìn. Giữ nguyên mức phóng — chỉ đổi tâm. */
  const revealAt = useCallback((x: number, y: number) => {
    setView((previous) => {
      if (!previous) return previous;
      const margin = SEAT_RADIUS * 4;
      const inside =
        x >= previous.x + margin &&
        x <= previous.x + previous.width - margin &&
        y >= previous.y + margin &&
        y <= previous.y + previous.height - margin;
      if (inside) return previous;
      return { ...previous, x: x - previous.width / 2, y: y - previous.height / 2 };
    });
  }, []);

  /**
   * Di chuyển con trỏ theo một hướng.
   *
   * Chấm điểm bằng khoảng cách theo trục chính cộng ba lần khoảng lệch ngang: không có hệ số ấy thì
   * mũi tên "sang phải" ở một khu hình cung sẽ nhảy sang một ghế chéo tận hàng dưới, vì nó gần hơn
   * theo đường thẳng.
   */
  const moveCursor = useCallback(
    (dx: number, dy: number) => {
      const points: Array<{ key: string; x: number; y: number }> = focusedZone
        ? zoneSeats.map((seat) => ({ key: seat.seatCode, x: seat.x, y: seat.y }))
        : floorPlan.zones.map((zone) => ({ key: zone.zoneCode, ...centreOf(zone.outline) }));

      if (points.length === 0) return;

      const from = points.find((point) => point.key === cursor);
      if (!from) {
        // Chưa có con trỏ: đặt vào điểm gần sân khấu nhất — chỗ người ta nhìn trước tiên.
        const first = [...points].sort((a, b) => a.y - b.y || a.x - b.x)[0];
        if (first) {
          setCursor(first.key);
          revealAt(first.x, first.y);
        }
        return;
      }

      let best: { key: string; x: number; y: number; score: number } | null = null;
      for (const point of points) {
        if (point.key === from.key) continue;
        const alongAxis = (point.x - from.x) * dx + (point.y - from.y) * dy;
        if (alongAxis <= 0) continue;
        const across = Math.abs((point.x - from.x) * dy - (point.y - from.y) * dx);
        const score = alongAxis + across * 3;
        if (!best || score < best.score) best = { ...point, score };
      }

      if (best) {
        setCursor(best.key);
        revealAt(best.x, best.y);
      }
    },
    [focusedZone, zoneSeats, floorPlan.zones, cursor, revealAt],
  );

  // Một handler cho cả sơ đồ. Đích của sự kiện tự nói nó là ghế nào hay khu nào.
  const handleClick = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      const target = event.target as SVGElement;
      const seatCode = target.dataset?.seatCode;
      if (seatCode) {
        onToggleSeat?.(seatCode, seatMarks?.get(seatCode));
        return;
      }
      const zoneCode = target.dataset?.zoneCode;
      const zone = zoneCode ? zonesByCode.get(zoneCode) : undefined;
      if (zone && zone.kind === 'SEATED' && zone.zoneCode !== focusedZone) {
        openZone(zone);
      }
    },
    [onToggleSeat, seatMarks, zonesByCode, focusedZone, openZone],
  );

  /**
   * Phóng quanh con trỏ, không quanh tâm khung.
   *
   * Phóng quanh tâm làm điểm người dùng đang nhắm trôi ra khỏi màn hình, và họ phải kéo lại sau
   * mỗi nấc lăn chuột.
   */
  const handleWheel = useCallback(
    (event: React.WheelEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const box = svg.getBoundingClientRect();
      const factor = event.deltaY > 0 ? 1.15 : 1 / 1.15;

      setView((previous) => {
        const from = previous ?? fullView;
        const width = clampSize(from.width * factor, fullView.width);
        const height = (width / from.width) * from.height;

        const px = (event.clientX - box.left) / box.width;
        const py = (event.clientY - box.top) / box.height;

        return {
          x: from.x + (from.width - width) * px,
          y: from.y + (from.height - height) * py,
          width,
          height,
        };
      });
    },
    [fullView],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      dragRef.current = { x: event.clientX, y: event.clientY, view: current };
      // Bắt con trỏ để cú kéo không đứt khi chuột đi ra ngoài khung sơ đồ. Không phải môi trường
      // nào cũng có API này (jsdom không có), và mất nó chỉ làm cú kéo kém mượt — không đáng để
      // cả sơ đồ ném lỗi.
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [current],
  );

  const handlePointerMove = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    const svg = svgRef.current;
    if (!drag || !svg) return;

    const box = svg.getBoundingClientRect();
    // Đổi khoảng dịch của con trỏ (pixel) sang đơn vị mặt bằng: cùng một cú kéo phải dịch sơ đồ
    // đúng bằng nhau ở mọi mức phóng.
    const dx = ((event.clientX - drag.x) / box.width) * drag.view.width;
    const dy = ((event.clientY - drag.y) / box.height) * drag.view.height;

    setView({ ...drag.view, x: drag.view.x - dx, y: drag.view.y - dy });
  }, []);

  const endDrag = useCallback(() => {
    dragRef.current = null;
  }, []);

  /** Enter/Space: mở khu khi đang xem toàn cảnh, chọn hoặc bỏ chọn ghế khi đã mở khu. */
  const activateCursor = useCallback(() => {
    if (!cursor) return;

    if (!focusedZone) {
      const zone = zonesByCode.get(cursor);
      if (zone && zone.kind === 'SEATED') openZone(zone);
      return;
    }
    onToggleSeat?.(cursor, seatMarks?.get(cursor));
  }, [cursor, focusedZone, zonesByCode, openZone, onToggleSeat, seatMarks]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<SVGSVGElement>) => {
      const steps: Record<string, [number, number]> = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
      };
      const step = steps[event.key];

      if (step) {
        // Chặn mặc định: mũi tên trong một sơ đồ phải di chuyển con trỏ, không cuộn cả trang.
        event.preventDefault();
        moveCursor(step[0], step[1]);
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        activateCursor();
        return;
      }
      if (event.key === 'Escape' && focusedZone) {
        event.preventDefault();
        reset();
      }
    },
    [moveCursor, activateCursor, focusedZone, reset],
  );

  /** Phóng quanh TÂM khung — nút bấm không có vị trí con trỏ để phóng quanh. */
  const zoomBy = useCallback(
    (factor: number) => {
      setView((previous) => {
        const from = previous ?? fullView;
        const width = clampSize(from.width * factor, fullView.width);
        const height = (width / from.width) * from.height;
        return {
          x: from.x + (from.width - width) / 2,
          y: from.y + (from.height - height) / 2,
          width,
          height,
        };
      });
    },
    [fullView],
  );

  const zoomed = view !== null;

  /**
   * Câu mô tả chỗ con trỏ đang đứng, đọc qua vùng `aria-live`.
   *
   * Không có nó thì người dùng trình đọc màn hình bấm mũi tên mà không nhận được phản hồi nào — với
   * họ sơ đồ im lặng hoàn toàn, và `<title>` trong SVG chỉ đọc được khi trỏ chuột vào.
   */
  const cursorLabel = useMemo(() => {
    if (!cursor) return '';
    if (!focusedZone) {
      const zone = zonesByCode.get(cursor);
      return zone ? zoneTitle(zone, availableByZone?.get(zone.zoneCode)) : '';
    }
    const seat = zoneSeats.find((candidate) => candidate.seatCode === cursor);
    return seat
      ? seatTitle(seat, seatMarks?.get(cursor), selectedSeatCodes?.has(cursor) ?? false)
      : '';
  }, [cursor, focusedZone, zonesByCode, availableByZone, zoneSeats, seatMarks, selectedSeatCodes]);

  return (
    <div className={cx(styles.wrap, className)}>
      <svg
        ref={svgRef}
        className={styles.canvas}
        viewBox={floorPlanViewBox(current)}
        role="group"
        aria-label={label ?? `Sơ đồ chỗ ${floorPlan.venueName}`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <Stage floorPlan={floorPlan} />

        {floorPlan.zones.map((zone) => (
          <Zone
            key={zone.zoneCode}
            zone={zone}
            focused={zone.zoneCode === focusedZone}
            dimmed={focusedZone !== null && zone.zoneCode !== focusedZone}
            available={availableByZone?.get(zone.zoneCode)}
            showLabel={!zoomed || zone.zoneCode === focusedZone}
            cursored={!focusedZone && zone.zoneCode === cursor}
          />
        ))}

        {visibleSeats.map((seat) => {
          const mark = seatMarks?.get(seat.seatCode);
          const selected = selectedSeatCodes?.has(seat.seatCode) ?? false;
          return (
            <g key={seat.seatCode}>
              <circle
                data-seat-code={seat.seatCode}
                className={cx(
                  styles.seat,
                  styles[seatTone(mark, selected)],
                  seat.seatCode === cursor && styles.seatCursor,
                )}
                cx={seat.x}
                cy={seat.y}
                r={SEAT_RADIUS}
              >
                <title>{seatTitle(seat, mark, selected)}</title>
              </circle>

              {/*
                Dấu tích trên ghế đã chọn — mã hoá THỨ HAI, không phải trang trí.

                Đo được: "còn trống" (#3fae74) và "ghế của tôi" (#f4796b) chỉ cách nhau ΔE 6,5 với
                người mù màu đỏ-lục. Ở mức đó màu một mình không đủ, và đây đúng là hai trạng thái
                quan trọng nhất của cả luồng mua. Chỉ vẽ cho ghế ĐÃ CHỌN, nên số node thêm vào bị
                chặn bởi trần mua vé chứ không tăng theo số ghế của khu.
              */}
              {selected ? (
                <path
                  className={styles.seatCheck}
                  pointerEvents="none"
                  d={`M ${seat.x - 0.17} ${seat.y} L ${seat.x - 0.04} ${seat.y + 0.13} L ${seat.x + 0.18} ${seat.y - 0.13}`}
                />
              ) : null}
            </g>
          );
        })}
      </svg>

      <div className={styles.controls}>
        {focusedZone ? (
          <button type="button" className={styles.control} onClick={reset}>
            Xem toàn cảnh
          </button>
        ) : (
          <p className={styles.hint}>Chọn một khu để xem từng ghế</p>
        )}

        {/*
          Nút phóng, không chỉ lăn chuột. Lăn chuột là đường duy nhất trước đây, và nó bỏ rơi hai
          nhóm: người dùng bàn phím, và người dùng cảm ứng — kéo một ngón đã dành cho việc di chuyển
          sơ đồ, nên không còn cử chỉ nào cho phóng.
        */}
        <div className={styles.zoomGroup}>
          <button
            type="button"
            className={styles.control}
            onClick={() => zoomBy(1 / 1.4)}
            aria-label="Phóng to sơ đồ"
          >
            +
          </button>
          <button
            type="button"
            className={styles.control}
            onClick={() => zoomBy(1.4)}
            aria-label="Thu nhỏ sơ đồ"
          >
            −
          </button>
        </div>

        <p className={styles.keyHint}>
          Bàn phím: Tab vào sơ đồ, mũi tên để đi, Enter để chọn
          {focusedZone ? ', Esc để xem toàn cảnh' : ''}.
        </p>
      </div>

      {/*
        Vùng đọc trực tiếp cho con trỏ bàn phím. `<title>` trong SVG chỉ đọc được khi TRỎ CHUỘT vào,
        nên không có khối này thì người dùng trình đọc màn hình bấm mũi tên và nhận lại sự im lặng.
      */}
      <p className={styles.live} role="status" aria-live="polite">
        {cursorLabel}
      </p>
    </div>
  );
}

// --- phần vẽ ---------------------------------------------------------------

function Stage({ floorPlan }: { floorPlan: FloorPlan }) {
  const { stage } = floorPlan;

  if (stage.shape === 'CIRCLE') {
    return (
      <g className={styles.stage}>
        <circle cx={stage.x} cy={stage.y} r={stage.width / 2} />
        <text x={stage.x} y={stage.y} className={styles.stageLabel}>
          SÂN KHẤU
        </text>
      </g>
    );
  }

  // THRUST vẽ như hộp bo tròn mạnh ở cạnh hướng về khán giả — nó là sân khấu nhô ra giữa khán đài,
  // và chi tiết ấy là thứ cho khách biết mình đang ngồi ở cánh hay ở chính diện.
  const radius = stage.shape === 'THRUST' ? Math.min(stage.width, stage.height) / 2 : 0.6;

  return (
    <g className={styles.stage}>
      <rect
        x={stage.x - stage.width / 2}
        y={stage.y - stage.height / 2}
        width={stage.width}
        height={stage.height}
        rx={radius}
      />
      <text x={stage.x} y={stage.y} className={styles.stageLabel}>
        SÂN KHẤU
      </text>
    </g>
  );
}

function Zone({
  zone,
  focused,
  dimmed,
  available,
  showLabel,
  cursored,
}: {
  zone: FloorPlanZone;
  focused: boolean;
  dimmed: boolean;
  available: number | undefined;
  showLabel: boolean;
  /** Con trỏ bàn phím đang đứng ở khu này — vẽ vòng đánh dấu, KHÔNG đổi màu nền khu. */
  cursored: boolean;
}) {
  const centre = useMemo(() => centreOf(zone.outline), [zone.outline]);

  return (
    <g className={cx(styles.zone, dimmed && styles.zoneDimmed)}>
      <path
        data-zone-code={zone.zoneCode}
        d={outlinePath(zone.outline)}
        className={cx(
          styles.zoneShape,
          zone.kind === 'STANDING' && styles.zoneStanding,
          focused && styles.zoneFocused,
          cursored && styles.zoneCursor,
        )}
      >
        <title>{zoneTitle(zone, available)}</title>
      </path>

      {showLabel ? (
        <text x={centre.x} y={centre.y} className={styles.zoneLabel} pointerEvents="none">
          {zone.name}
          {available !== undefined ? (
            <tspan className={styles.zoneCount}> · còn {available}</tspan>
          ) : null}
        </text>
      ) : null}
    </g>
  );
}

// --- hình học --------------------------------------------------------------

type Rect = FloorPlanRect;

type PlacedSeat = FloorPlanSeat;

function boundsOf(outline: Array<{ x: number; y: number }>): Rect {
  const xs = outline.map((p) => p.x);
  const ys = outline.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

function centreOf(outline: Array<{ x: number; y: number }>) {
  const box = boundsOf(outline);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Nới quanh một khu để nó không dính sát mép khung nhìn. */
function padded(rect: Rect): Rect {
  const pad = Math.max(rect.width, rect.height) * 0.08 + 1;
  return {
    x: rect.x - pad,
    y: rect.y - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
}

/**
 * Toạ độ ghế: ưu tiên bản mặt bằng mang sẵn, rơi về bản do nơi dùng đưa vào.
 *
 * Ghế không có toạ độ ở cả hai nguồn thì **bỏ qua**, không vẽ ở (0,0): một đống ghế chồng lên nhau
 * ở góc sơ đồ trông như một lỗi hiển thị, còn thiếu vài ghế thì nhìn ra ngay là thiếu dữ liệu.
 */
function placedSeats(
  zone: FloorPlanZone,
  positions: Map<string, { x: number; y: number }> | undefined,
): PlacedSeat[] {
  if (zone.seats.length > 0) return zone.seats;
  if (!positions) return [];

  const placed: PlacedSeat[] = [];
  for (const [seatCode, at] of positions) {
    if (seatCode.startsWith(`${zone.zoneCode}-`)) {
      placed.push({ seatCode, row: 0, seat: 0, x: at.x, y: at.y });
    }
  }
  return placed;
}

/** Nới một bán kính ghế mỗi phía để ghế nửa trong nửa ngoài khung không biến mất đột ngột. */
function cull(seats: PlacedSeat[], view: Rect): PlacedSeat[] {
  const left = view.x - SEAT_RADIUS;
  const top = view.y - SEAT_RADIUS;
  const right = view.x + view.width + SEAT_RADIUS;
  const bottom = view.y + view.height + SEAT_RADIUS;

  return seats.filter(
    (seat) => seat.x >= left && seat.x <= right && seat.y >= top && seat.y <= bottom,
  );
}

function clampSize(width: number, fullWidth: number): number {
  return Math.min(fullWidth, Math.max(fullWidth / MAX_ZOOM, width));
}

// --- nhãn ------------------------------------------------------------------

function seatTone(mark: SeatMark | undefined, selected: boolean) {
  if (selected) return 'seatMine' as const;
  if (!mark) return 'seatUnknown' as const;
  switch (mark.status) {
    case 'AVAILABLE':
      return 'seatAvailable' as const;
    case 'HELD':
      return 'seatHeld' as const;
    case 'RESERVED':
      return 'seatReserved' as const;
    case 'SOLD':
      return 'seatSold' as const;
    default:
      return 'seatBlocked' as const;
  }
}

function seatTitle(seat: PlacedSeat, mark: SeatMark | undefined, selected: boolean) {
  const where = seat.row > 0 ? `Hàng ${seat.row}, ghế ${seat.seat}` : seat.seatCode;
  if (selected) return `${where} — đang chọn`;
  if (!mark) return `${where} — chưa mở bán`;
  if (mark.status !== 'AVAILABLE') return `${where} — không còn trống`;
  return `${where} — ${mark.ticketTypeName ?? 'vé'}`;
}

function zoneTitle(zone: FloorPlanZone, available: number | undefined) {
  const size = zone.kind === 'STANDING' ? `${zone.seatCount} chỗ đứng` : `${zone.seatCount} ghế`;
  return available === undefined
    ? `${zone.name} — ${size}`
    : `${zone.name} — còn ${available}/${zone.seatCount}`;
}
