import type { FloorPlan } from '@nexaticket/ts-sdk/floor-plan';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SeatMapCanvas, type SeatMark } from '../components/SeatMapCanvas';

/**
 * Sơ đồ chỗ.
 *
 * Phần đáng kiểm nhất không phải "có vẽ ra không" mà là **vẽ bao nhiêu**: cả kiến trúc của
 * component này tồn tại để một khán phòng 20.000 chỗ không đẩy 20.000 node vào DOM. Một lần sửa
 * vô tình bỏ mức chi tiết theo khu sẽ không làm hỏng test nào nói về giao diện — nên những test
 * dưới đây đếm node.
 */

function planWith(seatsPerRow: number): FloorPlan {
  const seats = [];
  for (let row = 1; row <= 4; row++) {
    for (let seat = 1; seat <= seatsPerRow; seat++) {
      seats.push({ seatCode: `A-${row}-${seat}`, row, seat, x: seat, y: row * 1.4 });
    }
  }

  return {
    venueId: 'venue-1',
    venueName: 'Nhà hát Lớn',
    stage: { shape: 'RECTANGLE', x: 0, y: -7, width: 24, height: 4 },
    bounds: { minX: -12, minY: -9, maxX: 12, maxY: 10 },
    zones: [
      {
        zoneCode: 'A',
        name: 'Khu A',
        kind: 'SEATED',
        seatCount: 4 * seatsPerRow,
        layoutShape: 'GRID',
        outline: [
          { x: 0, y: 0 },
          { x: seatsPerRow + 1, y: 0 },
          { x: seatsPerRow + 1, y: 6 },
          { x: 0, y: 6 },
        ],
        seats,
      },
      {
        zoneCode: 'SAN',
        name: 'Khu đứng',
        kind: 'STANDING',
        seatCount: 2_000,
        layoutShape: 'GRID',
        outline: [
          { x: 0, y: 8 },
          { x: 20, y: 8 },
          { x: 20, y: 14 },
          { x: 0, y: 14 },
        ],
        seats: [],
      },
    ],
  };
}

function allAvailable(plan: FloorPlan): Map<string, SeatMark> {
  const marks = new Map<string, SeatMark>();
  for (const zone of plan.zones) {
    for (const seat of zone.seats) {
      marks.set(seat.seatCode, {
        id: seat.seatCode,
        status: 'AVAILABLE',
        priceVnd: 500_000,
        ticketTypeName: 'Hạng A',
      });
    }
  }
  return marks;
}

describe('SeatMapCanvas', () => {
  it('chưa chọn khu thì không vẽ một ghế nào', () => {
    const plan = planWith(50);
    const { container } = render(<SeatMapCanvas floorPlan={plan} seatMarks={allAvailable(plan)} />);

    // 200 ghế trong dữ liệu, 0 trong DOM. Đây là toàn bộ lý do component này thay cho lưới cũ:
    // với sân vận động thì con số bên trái là 20.000 và trình duyệt đứng hình ngay lúc mở bán.
    expect(container.querySelectorAll('[data-seat-code]')).toHaveLength(0);
    // Nhưng khu thì phải có, nếu không màn hình trống trơn.
    expect(container.querySelectorAll('[data-zone-code]')).toHaveLength(2);
  });

  it('bấm vào khu mới mở ra ghế của riêng khu đó', async () => {
    const plan = planWith(10);
    const { container } = render(<SeatMapCanvas floorPlan={plan} seatMarks={allAvailable(plan)} />);

    await userEvent.click(container.querySelector('[data-zone-code="A"]')!);

    expect(container.querySelectorAll('[data-seat-code]').length).toBeGreaterThan(0);
  });

  it('khu đứng không mở ra ghế — vé đứng không có chỗ đánh số', async () => {
    const plan = planWith(10);
    const { container } = render(<SeatMapCanvas floorPlan={plan} seatMarks={allAvailable(plan)} />);

    await userEvent.click(container.querySelector('[data-zone-code="SAN"]')!);

    expect(container.querySelectorAll('[data-seat-code]')).toHaveLength(0);
  });

  it('bấm một ghế báo đúng mã chỗ, qua handler dùng chung ở gốc svg', async () => {
    const plan = planWith(10);
    const onToggleSeat = vi.fn();
    const { container } = render(
      <SeatMapCanvas floorPlan={plan} seatMarks={allAvailable(plan)} onToggleSeat={onToggleSeat} />,
    );

    await userEvent.click(container.querySelector('[data-zone-code="A"]')!);
    await userEvent.click(container.querySelector('[data-seat-code="A-2-3"]')!);

    // Mã chỗ chứ không phải id: đó là khoá chung giữa hình học của catalog và tồn kho của inventory.
    expect(onToggleSeat).toHaveBeenCalledWith('A-2-3', expect.objectContaining({ status: 'AVAILABLE' }));
  });

  it('nhãn khu nói số chỗ còn trống, để chọn khu trước khi phóng to', () => {
    const plan = planWith(10);
    render(
      <SeatMapCanvas
        floorPlan={plan}
        seatMarks={allAvailable(plan)}
        availableByZone={new Map([['A', 12]])}
      />,
    );

    // Hai chỗ cùng nói con số này, và cả hai đều cần: nhãn vẽ trên sơ đồ, và <title> cho con trỏ
    // lẫn trình đọc màn hình.
    expect(screen.getAllByText(/còn 12/).length).toBeGreaterThanOrEqual(2);
  });

  it('ghế không có trong tồn kho vẫn vẽ được — màn xem trước của ban tổ chức chưa có tồn kho nào', async () => {
    const plan = planWith(10);
    const { container } = render(<SeatMapCanvas floorPlan={plan} />);

    await userEvent.click(container.querySelector('[data-zone-code="A"]')!);

    expect(container.querySelectorAll('[data-seat-code]').length).toBeGreaterThan(0);
  });
});
