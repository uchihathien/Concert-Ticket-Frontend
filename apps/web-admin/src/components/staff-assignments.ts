import type {
  AssignmentTarget,
  CheckinAssignmentStatus,
  StaffAssignment,
  StaffMember,
  StatsSession,
} from '@nexaticket/ts-sdk';

/**
 * Logic thuần của việc phân công soát vé — dùng chung cho trang Phân công (/staff) và hành động "Gán
 * sự kiện" ở trang Thành viên, để hai nơi không tự tính hai kiểu.
 *
 * Luật hạn nằm ở backend (ticketing `AssignmentWindow`): phân công hết hiệu lực khi suất cuối trong
 * phạm vi được gán kết thúc quá 6 giờ. Ở đây chỉ dùng cùng con số để quyết định sự kiện nào còn đáng
 * hiện trong ô chọn — chốt chặn thật vẫn là backend ở mỗi lượt quét.
 */

/** Cùng giá trị `AssignmentWindow.GRACE` và `FALLBACK_DURATION` của ticketing. */
const GRACE_MS = 6 * 60 * 60 * 1000;
const FALLBACK_DURATION_MS = 6 * 60 * 60 * 1000;

/** Phạm vi gán của một sự kiện: cả sự kiện, hoặc một số suất. */
export type EventSelection = 'ALL' | string[];

export const STATUS_LABEL: Record<
  CheckinAssignmentStatus,
  { label: string; tone: 'accent' | 'success' | 'neutral' | 'warn' }
> = {
  UPCOMING: { label: 'Sắp tới', tone: 'accent' },
  ONGOING: { label: 'Đang diễn ra', tone: 'success' },
  EXPIRED: { label: 'Đã hết hạn', tone: 'neutral' },
  UNKNOWN: { label: 'Chưa rõ lịch', tone: 'warn' },
};

export function isActive(assignment: StaffAssignment): boolean {
  return assignment.status !== 'EXPIRED';
}

/** Các mục CÒN HIỆU LỰC của một Staff, đúng dạng gửi lên API. */
export function activeTargets(assignments: StaffAssignment[]): AssignmentTarget[] {
  return assignments
    .filter(isActive)
    .map((assignment) => ({ eventId: assignment.eventId, eventSessionId: assignment.eventSessionId }));
}

/** Gom phân công còn hiệu lực theo sự kiện. Đã gán cả sự kiện thì các suất riêng không còn ý nghĩa. */
export function selectionFromAssignments(assignments: StaffAssignment[]): Map<string, EventSelection> {
  const selection = new Map<string, EventSelection>();
  for (const assignment of assignments.filter(isActive)) {
    const current = selection.get(assignment.eventId);
    if (assignment.eventSessionId === null || current === 'ALL') {
      selection.set(assignment.eventId, 'ALL');
    } else {
      selection.set(assignment.eventId, [...(current ?? []), assignment.eventSessionId]);
    }
  }
  return selection;
}

export function targetsFromSelection(selection: Map<string, EventSelection>): AssignmentTarget[] {
  const targets: AssignmentTarget[] = [];
  selection.forEach((scope, eventId) => {
    if (scope === 'ALL') {
      targets.push({ eventId, eventSessionId: null });
    } else {
      scope.forEach((sessionId) => targets.push({ eventId, eventSessionId: sessionId }));
    }
  });
  return targets;
}

function sameScope(a: AssignmentTarget, eventId: string, sessionId: string | null): boolean {
  return a.eventId === eventId && (a.eventSessionId ?? null) === sessionId;
}

/** Staff này có đang được gán đúng phạm vi (sự kiện, suất) không — cả sự kiện thì phủ mọi suất. */
export function covers(assignments: StaffAssignment[], eventId: string, sessionId: string | null): 'EXACT' | 'WHOLE_EVENT' | null {
  const targets = activeTargets(assignments);
  if (targets.some((target) => sameScope(target, eventId, sessionId))) return 'EXACT';
  if (sessionId !== null && targets.some((target) => sameScope(target, eventId, null))) return 'WHOLE_EVENT';
  return null;
}

/** Thêm hoặc bớt đúng một phạm vi, giữ nguyên mọi phân công còn hiệu lực khác. */
export function toggleScope(
  assignments: StaffAssignment[],
  eventId: string,
  sessionId: string | null,
  on: boolean,
): AssignmentTarget[] {
  const others = activeTargets(assignments).filter((target) => !sameScope(target, eventId, sessionId));
  return on ? [...others, { eventId, eventSessionId: sessionId }] : others;
}

function sessionEnd(session: StatsSession): number {
  const start = new Date(session.startsAt).getTime();
  return session.endsAt ? new Date(session.endsAt).getTime() : start + FALLBACK_DURATION_MS;
}

/**
 * Sự kiện còn gán được: chưa có suất nào, hoặc còn ít nhất một suất chưa kết thúc quá 6 giờ.
 * Sự kiện đã qua hẳn thì gán vào cũng hết hạn ngay — không mời người dùng bấm vào đó.
 */
export function isAssignable(sessions: StatsSession[], now: number = Date.now()): boolean {
  return sessions.length === 0 || sessions.some((session) => sessionEnd(session) + GRACE_MS >= now);
}

/** Suất còn gán được của một sự kiện, sớm nhất trước. */
export function assignableSessions(sessions: StatsSession[], now: number = Date.now()): StatsSession[] {
  return sessions
    .filter((session) => sessionEnd(session) + GRACE_MS >= now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function displayName(member: Pick<StaffMember, 'fullName' | 'email' | 'userId'>): string {
  return member.fullName ?? member.email ?? member.userId;
}
