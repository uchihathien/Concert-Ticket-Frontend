'use client';

import {
  ApiError,
  useAdminEvents,
  useSetStaffAssignments,
  useStatsSessions,
  type StaffAssignment,
  type StatsSession,
} from '@nexaticket/ts-sdk';
import { Button, Modal, formatDate, useToast } from '@nexaticket/ui';
import { useEffect, useMemo, useState } from 'react';
import {
  assignableSessions,
  isAssignable,
  selectionFromAssignments,
  targetsFromSelection,
  type EventSelection,
} from './staff-assignments';

export interface StaffAssignmentDialogProps {
  organizationId: string;
  /** Thành viên vai Staff đang được gán; `null` là đóng hộp. */
  member: { userId: string; name: string; assignments: StaffAssignment[] } | null;
  onClose: () => void;
}

/**
 * Gán sự kiện (hoặc từng suất) cho MỘT thành viên vai Staff.
 *
 * Dùng chung ở hai chỗ: hành động "Gán sự kiện" của dòng Staff trong trang Thành viên, và trang Phân
 * công soát vé. Một component để hai nơi không lệch nhau về cách hiểu "cả sự kiện" và "từng suất".
 *
 * Chỉ hiện sự kiện còn gán được (còn suất chưa kết thúc quá 6 giờ). Phân công đã hết hạn không hiện
 * ở đây và không bị đụng tới khi Lưu — backend giữ chúng làm lịch sử.
 */
export function StaffAssignmentDialog({ organizationId, member, onClose }: StaffAssignmentDialogProps) {
  const toast = useToast();
  const events = useAdminEvents(member ? organizationId : null);
  const sessions = useStatsSessions(member ? organizationId : null);
  const save = useSetStaffAssignments(organizationId);
  const [selection, setSelection] = useState<Map<string, EventSelection>>(new Map());

  // Mở cho người khác là bắt đầu lại từ phân công của chính người đó.
  useEffect(() => {
    setSelection(selectionFromAssignments(member?.assignments ?? []));
  }, [member]);

  const sessionsByEvent = useMemo(() => {
    const byEvent = new Map<string, StatsSession[]>();
    for (const session of sessions.data ?? []) {
      byEvent.set(session.eventId, [...(byEvent.get(session.eventId) ?? []), session]);
    }
    return byEvent;
  }, [sessions.data]);

  const choices = useMemo(
    () =>
      (events.data ?? [])
        .filter((event) => event.status !== 'CANCELLED')
        .filter((event) => isAssignable(sessionsByEvent.get(event.id) ?? []) || selection.has(event.id))
        .sort((a, b) => (a.nextSessionAt ?? '9999').localeCompare(b.nextSessionAt ?? '9999')),
    [events.data, sessionsByEvent, selection],
  );

  const setScope = (eventId: string, scope: EventSelection | null) => {
    setSelection((current) => {
      const next = new Map(current);
      if (scope === null || (Array.isArray(scope) && scope.length === 0)) next.delete(eventId);
      else next.set(eventId, scope);
      return next;
    });
  };

  const submit = () => {
    if (!member) return;
    save.mutate(
      { userId: member.userId, targets: targetsFromSelection(selection) },
      {
        onSuccess: () => {
          onClose();
          toast.show({ tone: 'success', message: 'Đã cập nhật phân công soát vé' });
        },
        onError: (error) => toast.showError(error instanceof ApiError ? error : null),
      },
    );
  };

  return (
    <Modal
      open={member !== null}
      onClose={onClose}
      title="Gán sự kiện soát vé"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Huỷ
          </Button>
          <Button onClick={submit} loading={save.isPending}>
            Lưu
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <p className="m-0 text-muted">{member?.name}</p>
        {events.isPending || sessions.isPending ? (
          <p className="m-0 text-muted">Đang tải sự kiện...</p>
        ) : choices.length === 0 ? (
          <p className="m-0 text-muted">Không có sự kiện nào sắp diễn ra để gán.</p>
        ) : (
          <fieldset className="m-0 grid gap-3 border-0 p-0">
            <legend className="mb-1 p-0 text-[13px] font-medium">Sự kiện được soát</legend>
            <div className="grid max-h-80 gap-3 overflow-y-auto">
              {choices.map((event) => {
                const scope = selection.get(event.id);
                const eventSessions = assignableSessions(sessionsByEvent.get(event.id) ?? []);
                return (
                  <div key={event.id} className="grid gap-1.5">
                    <label className="flex cursor-pointer items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={scope === 'ALL'}
                        onChange={(change) => setScope(event.id, change.target.checked ? 'ALL' : null)}
                      />
                      <span className="grid gap-0.5">
                        <span>{event.title}</span>
                        <span className="text-[13px] text-muted">
                          {[event.venueName, event.nextSessionAt ? formatDate(event.nextSessionAt) : null]
                            .filter(Boolean)
                            .join(' · ') || 'Chưa có suất'}
                          {eventSessions.length > 1 ? ' · cả sự kiện' : ''}
                        </span>
                      </span>
                    </label>
                    {/* Chỉ cần chọn từng suất khi sự kiện có nhiều suất — đêm nào người nấy. */}
                    {eventSessions.length > 1 && scope !== 'ALL' ? (
                      <div className="ml-6 grid gap-1">
                        {eventSessions.map((session) => {
                          const picked = Array.isArray(scope) && scope.includes(session.eventSessionId);
                          return (
                            <label key={session.eventSessionId} className="flex cursor-pointer items-center gap-2 text-[14px]">
                              <input
                                type="checkbox"
                                checked={picked}
                                onChange={(change) => {
                                  const current = Array.isArray(scope) ? scope : [];
                                  setScope(
                                    event.id,
                                    change.target.checked
                                      ? [...current, session.eventSessionId]
                                      : current.filter((id) => id !== session.eventSessionId),
                                  );
                                }}
                              />
                              <span>Suất {formatDate(session.startsAt)}</span>
                            </label>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </fieldset>
        )}
        <p className="m-0 text-[13px] text-muted">
          Phân công tự hết hiệu lực 6 giờ sau khi suất cuối được gán kết thúc. Người này vẫn là Staff của tổ
          chức để lần sau gán tiếp. Bỏ chọn là gỡ quyền soát vé ở sự kiện đó ngay.
        </p>
      </div>
    </Modal>
  );
}
