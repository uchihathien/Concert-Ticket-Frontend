import { formatDateTime } from '@nexaticket/ui';
import type { RatioRow } from './SimpleCharts';
import type { SessionInfo } from './useSessionDirectory';

export function startOf(sessions: Map<string, SessionInfo>, sessionId: string): number {
  const info = sessions.get(sessionId);
  return info ? Date.parse(info.startsAt) : 0;
}

/** Tên sự kiện + giờ diễn; rơi về mã suất khi danh bạ chưa tải xong hoặc suất đã bị xoá. */
export function sessionLabel(sessions: Map<string, SessionInfo>, sessionId: string) {
  const info = sessions.get(sessionId);
  return info
    ? { label: info.eventTitle, sublabel: formatDateTime(info.startsAt) }
    : { label: `Suất ${sessionId.slice(0, 8)}`, sublabel: undefined };
}

export function sessionText(sessions: Map<string, SessionInfo>, sessionId: string): string {
  const { label, sublabel } = sessionLabel(sessions, sessionId);
  return sublabel ? `${label} · ${sublabel}` : label;
}

/**
 * Lấp đầy của những suất SẮP diễn, suất gần nhất đứng đầu.
 *
 * Suất đã diễn xong không còn bán được vé nào nữa; đưa chúng lên đầu là chiếm chỗ của đúng những
 * suất mà ban tổ chức còn làm được điều gì đó. Khi không còn suất sắp diễn thì mới hiện suất cũ.
 */
export function fillBars(
  rows: { eventSessionId: string; capacity: number; blocked: number; sold: number }[],
  sessions: Map<string, SessionInfo>,
  limit: number,
): RatioRow[] {
  const bySession = new Map<string, { sold: number; capacity: number }>();
  for (const row of rows) {
    const current = bySession.get(row.eventSessionId) ?? { sold: 0, capacity: 0 };
    current.sold += row.sold;
    current.capacity += row.capacity - row.blocked;
    bySession.set(row.eventSessionId, current);
  }
  const now = Date.now();
  const all = [...bySession.entries()].map(([id, value]) => ({ id, ...value, startsAt: startOf(sessions, id) }));
  const upcoming = all.filter((row) => row.startsAt > now).sort((a, b) => a.startsAt - b.startsAt);
  const chosen = upcoming.length > 0 ? upcoming : all.sort((a, b) => b.startsAt - a.startsAt);
  return chosen.slice(0, limit).map((row) => ({
    key: row.id,
    ...sessionLabel(sessions, row.id),
    part: row.sold,
    whole: row.capacity,
  }));
}
