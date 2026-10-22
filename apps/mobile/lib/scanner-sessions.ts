import {
  getMyCheckinEvents,
  getMyOrganizations,
  getMyPermissions,
  listCheckinSessions,
  listMyShifts,
  type CheckinSession,
  type MyShift,
} from '@nexaticket/ts-sdk';
import { api } from './api';

export interface ScannerSession extends CheckinSession {
  organizationId: string;
  organizationName: string;
}

export interface ScannerContext {
  /** Suất chưa kết thúc của mọi tổ chức mà tài khoản được soát vé, sớm nhất trước. */
  sessions: ScannerSession[];
  /** Tổ chức mà tài khoản được cho vào thủ công (ghi đè kết quả của máy). */
  overrideOrganizations: string[];
  /**
   * Tài khoản chỉ soát được những sự kiện ban tổ chức đã gán (nhân viên soát vé được mời), không
   * phải người quản lý sự kiện của tổ chức.
   */
  assignedOnly: boolean;
  /** Tổ chức mà tài khoản được soát vé — kể cả khi chưa có suất nào. */
  organizations: { id: string; name: string }[];
}

/**
 * Suất mà nhân viên này soát được.
 *
 * Backend đã bỏ suất đã kết thúc và đã kiểm quyền theo từng tổ chức; ở đây gộp lại và, với nhân
 * viên soát vé, giữ đúng những suất thuộc sự kiện được gán. Quyền cho
 * vào thủ công đi kèm vì cùng một lời gọi `/v1/me/permissions` trả lời được cả hai câu hỏi.
 */
export async function loadScannerContext(): Promise<ScannerContext> {
  const [organizations, permissions] = await Promise.all([getMyOrganizations(api), getMyPermissions(api)]);
  const permitted = organizations.filter(
    (organization) =>
      organization.status === 'ACTIVE' && permissions.organizations[organization.id]?.includes('CHECKIN_SCAN'),
  );
  let assignedOnly = permitted.length > 0;
  const lists = await Promise.all(
    permitted.map(async (organization) => {
      const [sessions, mine] = await Promise.all([
        listCheckinSessions(api, organization.id),
        getMyCheckinEvents(api, organization.id),
      ]);
      if (!mine.restricted) assignedOnly = false;
      return sessions
        // Nhân viên soát vé chỉ thấy suất của sự kiện được gán. Đây là để màn hình khỏi mời họ
        // bấm vào một suất sẽ bị từ chối — chốt chặn thật nằm ở backend, ở mỗi lượt quét.
        .filter((session) => !mine.restricted || mine.eventIds.includes(session.eventId))
        .map((session) => ({
          ...session,
          organizationId: organization.id,
          organizationName: organization.name,
        }));
    }),
  );
  return {
    sessions: lists.flat().sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    overrideOrganizations: permitted
      .filter((organization) => permissions.organizations[organization.id]?.includes('CATALOG_MANAGE'))
      .map((organization) => organization.id),
    assignedOnly,
    organizations: permitted.map((organization) => ({ id: organization.id, name: organization.name })),
  };
}

/** Cùng quy tắc với backend (`GateWindow`): cửa mở 2 giờ trước giờ diễn, đóng khi suất kết thúc. */
const GATES_OPEN_BEFORE_MS = 2 * 60 * 60 * 1000;
const FALLBACK_DURATION_MS = 6 * 60 * 60 * 1000;

function gateOpen(session: ScannerSession, now: Date): boolean {
  const startsAt = new Date(session.startsAt).getTime();
  const closesAt = session.endsAt ? new Date(session.endsAt).getTime() : startsAt + FALLBACK_DURATION_MS;
  return now.getTime() >= startsAt - GATES_OPEN_BEFORE_MS && now.getTime() <= closesAt;
}

/**
 * Có cho người dùng tự đổi suất hay không.
 *
 * Nhân viên được mời đã được ban tổ chức gán sự kiện, nên app tự mở đúng suất và không hỏi lại. Nút
 * đổi suất chỉ hiện với họ khi có HƠN MỘT suất được gán đang mở cửa cùng lúc — khi đó không ai
 * ngoài họ biết mình đang đứng ở cổng nào. Người quản lý sự kiện thì soát mọi suất của tổ chức nên
 * luôn được chọn.
 */
export function canSwitchSession(context: ScannerContext, now: Date = new Date()): boolean {
  if (!context.assignedOnly) return context.sessions.length > 1;
  return context.sessions.filter((session) => gateOpen(session, now)).length > 1;
}

/**
 * Suất để mở sẵn máy quét: suất đang diễn ra, không có thì suất sắp diễn gần nhất.
 *
 * Nhiều suất cùng đang diễn thì lấy suất bắt đầu muộn nhất — đêm nay, không phải đêm qua còn chưa
 * tới giờ kết thúc.
 */
export function pickSession(sessions: ScannerSession[], now: Date = new Date()): ScannerSession | null {
  const started = sessions.filter((session) => new Date(session.startsAt).getTime() <= now.getTime());
  return started[started.length - 1] ?? sessions[0] ?? null;
}

export function scanParams(session: ScannerSession) {
  return {
    eventSessionId: session.eventSessionId,
    organizationId: session.organizationId,
    eventTitle: session.eventTitle,
    venueName: session.venueName,
    startsAt: session.startsAt,
  };
}

/** Ca của tôi, gộp mọi tổ chức, kèm tên tổ chức để hiện. */
export interface MyShiftItem extends MyShift {
  organizationName: string;
}

export interface MyShiftsContext {
  shifts: MyShiftItem[];
  /** Người quản lý sự kiện: không bị ràng buộc ca, soát được mọi suất. */
  manager: boolean;
  /** Có ít nhất một tổ chức cho soát vé (không có thì màn này còn là nơi nhận lời mời). */
  hasScannerOrganization: boolean;
  scanner: ScannerContext;
}

export async function loadMyShifts(): Promise<MyShiftsContext> {
  const scanner = await loadScannerContext();
  const lists = await Promise.all(
    scanner.organizations.map(async (organization) =>
      (await listMyShifts(api, organization.id)).map((shift) => ({ ...shift, organizationName: organization.name })),
    ),
  );
  return {
    shifts: lists.flat().sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    manager: !scanner.assignedOnly && scanner.organizations.length > 0,
    hasScannerOrganization: scanner.organizations.length > 0,
    scanner,
  };
}

/** Tham số mở máy quét cho một ca đã bắt đầu: cổng cố định theo ca. */
export function shiftScanParams(shift: MyShiftItem) {
  return {
    eventSessionId: shift.eventSessionId,
    organizationId: shift.organizationId,
    eventTitle: shift.eventTitle ?? '',
    startsAt: shift.sessionStartsAt ?? shift.startsAt,
    shiftId: shift.id,
    gateName: shift.gateName,
    shiftEndsAt: shift.endsAt,
  };
}
