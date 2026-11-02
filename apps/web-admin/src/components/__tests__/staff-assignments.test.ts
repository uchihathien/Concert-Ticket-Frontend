import type { StaffAssignment, StatsSession } from '@nexaticket/ts-sdk';
import { describe, expect, it } from 'vitest';
import {
  activeTargets,
  covers,
  isAssignable,
  selectionFromAssignments,
  targetsFromSelection,
  toggleScope,
} from '../staff-assignments';

function assignment(eventId: string, eventSessionId: string | null, status: StaffAssignment['status'] = 'UPCOMING'): StaffAssignment {
  return { eventId, eventSessionId, eventTitle: null, startsAt: null, expiresAt: null, status };
}

function session(startsAt: string, endsAt: string | null = null): StatsSession {
  return { eventSessionId: startsAt, eventId: 'e', eventTitle: 'E', eventStatus: 'PUBLISHED', startsAt, endsAt };
}

describe('phân công soát vé', () => {
  it('bỏ qua phân công đã hết hạn khi dựng danh sách gửi lên — chúng là lịch sử, backend tự giữ', () => {
    expect(activeTargets([assignment('a', null), assignment('b', null, 'EXPIRED')])).toEqual([
      { eventId: 'a', eventSessionId: null },
    ]);
  });

  it('gom theo sự kiện: cả sự kiện thắng các suất riêng', () => {
    const selection = selectionFromAssignments([
      assignment('a', 's1'),
      assignment('a', null),
      assignment('b', 's2'),
      assignment('b', 's3'),
    ]);
    expect(selection.get('a')).toBe('ALL');
    expect(selection.get('b')).toEqual(['s2', 's3']);
    expect(targetsFromSelection(selection)).toEqual([
      { eventId: 'a', eventSessionId: null },
      { eventId: 'b', eventSessionId: 's2' },
      { eventId: 'b', eventSessionId: 's3' },
    ]);
  });

  it('gán cả sự kiện thì phủ mọi suất của nó', () => {
    const mine = [assignment('a', null)];
    expect(covers(mine, 'a', null)).toBe('EXACT');
    expect(covers(mine, 'a', 's1')).toBe('WHOLE_EVENT');
    expect(covers(mine, 'b', null)).toBeNull();
  });

  it('bật/tắt một phạm vi giữ nguyên các phân công còn hiệu lực khác', () => {
    const mine = [assignment('a', null), assignment('b', 's1'), assignment('c', null, 'EXPIRED')];
    expect(toggleScope(mine, 'b', 's1', false)).toEqual([{ eventId: 'a', eventSessionId: null }]);
    expect(toggleScope(mine, 'd', null, true)).toEqual([
      { eventId: 'a', eventSessionId: null },
      { eventId: 'b', eventSessionId: 's1' },
      { eventId: 'd', eventSessionId: null },
    ]);
  });

  it('sự kiện đã qua quá 6 giờ thì không còn gán được; chưa có suất thì vẫn gán được', () => {
    const now = new Date('2026-12-02T00:00:00Z').getTime();
    expect(isAssignable([], now)).toBe(true);
    // Bắt đầu 12:00, không khai giờ kết thúc → coi như xong 18:00, hết hạn 00:00 hôm sau.
    expect(isAssignable([session('2026-12-01T12:00:00Z')], now)).toBe(true);
    expect(isAssignable([session('2026-12-01T12:00:00Z', '2026-12-01T15:00:00Z')], now)).toBe(false);
  });
});
