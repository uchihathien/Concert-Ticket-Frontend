import { describe, expect, it } from 'vitest';
import {
  seatPositionsFitFloorPlan,
  type FloorPlan,
  type FloorPlanPoint,
} from '../types/floor-plan';

/**
 * Phép kiểm "toạ độ ghế có khớp mặt bằng không".
 *
 * Các con số dưới đây lấy từ dữ liệu thật của suất `dem-nhac-trinh`: khu A trải x −13.5→13.5,
 * y −3.2→22; khu B nằm hẳn phía sau ở y 23.1→37.1. Còn tồn kho của suất ấy lại giữ toạ độ 1…26 ×
 * 1…18 cho **cả hai** khu — chỉ số hàng/cột, không phải mét. Đó chính là ca hỏng cần bắt.
 */

function zone(zoneCode: string, box: { minX: number; minY: number; maxX: number; maxY: number }) {
  return {
    zoneCode,
    name: `Khu ${zoneCode}`,
    kind: 'SEATED' as const,
    seatCount: 0,
    layoutShape: 'GRID' as const,
    layout: {
      shape: 'GRID' as const,
      originX: 0,
      originY: 0,
      rotationDeg: 0,
      innerRadius: null,
      startAngleDeg: null,
      endAngleDeg: null,
    },
    outline: [
      { x: box.minX, y: box.minY },
      { x: box.maxX, y: box.minY },
      { x: box.maxX, y: box.maxY },
      { x: box.minX, y: box.maxY },
    ],
    seats: [],
  };
}

const PLAN: FloorPlan = {
  venueId: 'v1',
  venueName: 'Nhà hát Hoà Bình',
  stage: { shape: 'RECTANGLE', x: 0, y: -7, width: 24, height: 4 },
  zones: [
    zone('A', { minX: -13.5, minY: -3.2, maxX: 13.5, maxY: 22 }),
    zone('B', { minX: -12.5, minY: 23.1, maxX: 12.5, maxY: 37.1 }),
  ],
  bounds: { minX: -13.5, minY: -9, maxX: 13.5, maxY: 45.2 },
};

function positions(entries: Array<[string, FloorPlanPoint]>) {
  return new Map(entries);
}

describe('seatPositionsFitFloorPlan', () => {
  it('toạ độ mét đúng khu: vẽ được', () => {
    expect(
      seatPositionsFitFloorPlan(
        PLAN,
        positions([
          ['A-1-1', { x: -12, y: 0 }],
          ['A-1-2', { x: -11, y: 0 }],
          ['B-1-1', { x: -10, y: 25 }],
        ]),
      ),
    ).toBe(true);
  });

  it('toạ độ là chỉ số hàng/cột: KHÔNG vẽ', () => {
    // Ghế khu B mang y 1…10 — nằm gọn trong khu A, cách khu B của chính nó 20 mét. Đây là dạng
    // hỏng mà bao hình cả mặt bằng không bắt được: mọi điểm đều nằm trong khán phòng.
    expect(
      seatPositionsFitFloorPlan(
        PLAN,
        positions([
          ['A-1-1', { x: 1, y: 1 }],
          ['A-1-2', { x: 2, y: 1 }],
          ['B-1-1', { x: 1, y: 1 }],
          ['B-1-2', { x: 2, y: 2 }],
        ]),
      ),
    ).toBe(false);
  });

  it('vài ghế mép nhô khỏi đa giác vẫn chấp nhận được', () => {
    // Khu hình cung đặt ghế theo cung tròn; đa giác bao chỉ là xấp xỉ, nên đòi 100% nằm trong sẽ
    // loại cả những sơ đồ đúng.
    const many: Array<[string, FloorPlanPoint]> = [];
    for (let i = 0; i < 20; i++) many.push([`A-1-${i}`, { x: -10 + i, y: 5 }]);
    many.push(['A-2-1', { x: 14.2, y: 5 }]);

    expect(seatPositionsFitFloorPlan(PLAN, positions(many))).toBe(true);
  });

  it('không có toạ độ nào: không vẽ được, và đó không phải lỗi', () => {
    // Suất chưa dựng tồn kho. Người gọi rơi về cách hiển thị khác chứ không báo hỏng.
    expect(seatPositionsFitFloorPlan(PLAN, positions([]))).toBe(false);
  });

  it('khu không có ghế nào trong dữ liệu thì bỏ qua, không kéo cả sơ đồ xuống', () => {
    // Khu B chưa mở bán nên sơ đồ tồn kho không có ghế nào của nó. Coi đó là "sai" sẽ chặn cả
    // những sơ đồ hoàn toàn đúng.
    expect(
      seatPositionsFitFloorPlan(
        PLAN,
        positions([
          ['A-1-1', { x: -12, y: 0 }],
          ['A-1-2', { x: -11, y: 0 }],
        ]),
      ),
    ).toBe(true);
  });
});
