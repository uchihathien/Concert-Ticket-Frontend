'use client';

import {
  ApiError,
  useAdminEvents,
  useHasPermission,
  useSetStaffAssignments,
  useStaff,
  useStatsSessions,
  type OrganizationSummary,
  type StaffMember,
  type StatsSession,
} from '@nexaticket/ts-sdk';
import {
  ActionMenu,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  RowActions,
  Section,
  Select,
  Table,
  formatDate,
  useToast,
  type ActionMenuItem,
} from '@nexaticket/ui';
import { CalendarCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { OrganizationGate } from '@/components/OrganizationGate';
import { StaffAssignmentDialog } from '@/components/StaffAssignmentDialog';
import {
  STATUS_LABEL,
  assignableSessions,
  covers,
  displayName,
  isAssignable,
  toggleScope,
} from '@/components/staff-assignments';
import { StaffHistory } from './staff-history';
import { StaffShifts } from './staff-shifts';

/**
 * A-STAFF — phân công soát vé.
 *
 * <h3>Quy trình</h3>
 *
 * Nhân viên tự đăng ký tài khoản NexaTicket; ban tổ chức thêm họ ở mục Thành viên với vai Staff. Gần
 * ngày diễn, ban tổ chức vào đây chọn sự kiện (hoặc một suất), tick những Staff sẽ đứng cổng, rồi
 * Lưu. Staff chỉ soát được sự kiện được gán, và phân công tự hết hiệu lực 6 giờ sau khi suất cuối
 * kết thúc — người đó vẫn là Staff của tổ chức để lần sau gán tiếp.
 *
 * Trang này KHÔNG tạo tài khoản nữa: cấp tài khoản PIN và mời bằng email đã bỏ.
 *
 * <h3>Ai KHÔNG nằm trong bảng này</h3>
 *
 * Chủ tổ chức, quản trị và quản lý sự kiện tự soát được mọi sự kiện của tổ chức, nên không cần gán.
 */
export default function StaffPage() {
  return (
    <OrganizationGate title="Phân công soát vé">
      {(organization) => <StaffContent organization={organization} />}
    </OrganizationGate>
  );
}

function StaffContent({ organization }: { organization: OrganizationSummary }) {
  const toast = useToast();
  const router = useRouter();
  const organizationId = organization.id;
  const canManage = useHasPermission('ORG_MEMBERS_MANAGE', organizationId);

  // Backend đòi ORG_MEMBERS_MANAGE cho cả bảng. Không gọi khi thiếu quyền, nếu không người quản lý
  // sự kiện mở trang này sẽ thấy một khối lỗi 403 mà họ không làm gì được.
  const staff = useStaff(canManage ? organizationId : null);
  const events = useAdminEvents(canManage ? organizationId : null);
  const sessions = useStatsSessions(canManage ? organizationId : null);
  const save = useSetStaffAssignments(organizationId);

  const [eventId, setEventId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);

  const sessionsByEvent = useMemo(() => {
    const byEvent = new Map<string, StatsSession[]>();
    for (const session of sessions.data ?? []) {
      byEvent.set(session.eventId, [...(byEvent.get(session.eventId) ?? []), session]);
    }
    return byEvent;
  }, [sessions.data]);

  /** Sự kiện còn gán được, gần ngày diễn nhất trước. */
  const eventOptions = useMemo(
    () =>
      (events.data ?? [])
        .filter((event) => event.status !== 'CANCELLED' && isAssignable(sessionsByEvent.get(event.id) ?? []))
        .sort((a, b) => (a.nextSessionAt ?? '9999').localeCompare(b.nextSessionAt ?? '9999'))
        .map((event) => ({
          value: event.id,
          label: event.nextSessionAt ? `${event.title} · ${formatDate(event.nextSessionAt)}` : event.title,
        })),
    [events.data, sessionsByEvent],
  );

  const sessionOptions = useMemo(
    () =>
      assignableSessions(sessionsByEvent.get(eventId) ?? []).map((session) => ({
        value: session.eventSessionId,
        label: `Suất ${formatDate(session.startsAt)}`,
      })),
    [eventId, sessionsByEvent],
  );

  const scopeSession = sessionId || null;
  // Ổn định tham chiếu: `?? []` tạo mảng mới mỗi lần render và kéo effect bên dưới chạy mãi.
  const rows = useMemo(() => staff.data ?? [], [staff.data]);

  // Đổi phạm vi đang xem là đọc lại ai đang được gán đúng phạm vi đó.
  useEffect(() => {
    if (!eventId) {
      setChecked(new Set());
      return;
    }
    setChecked(
      new Set(
        rows.filter((row) => covers(row.assignments, eventId, scopeSession) !== null).map((row) => row.userId),
      ),
    );
    // `rows` đổi sau mỗi lần lưu (bảng được làm mới) — đó là lúc cần đọc lại.
  }, [eventId, scopeSession, rows]);

  const eventTitles = useMemo(
    () => new Map((events.data ?? []).map((event) => [event.id, event.title])),
    [events.data],
  );

  /**
   * Lưu phân công cho phạm vi đang chọn: chỉ gửi cho những Staff có thay đổi, mỗi người một lệnh.
   * Phân công khác của họ (sự kiện khác, suất khác) giữ nguyên.
   */
  const submit = async () => {
    const changed = rows.filter((row) => {
      const was = covers(row.assignments, eventId, scopeSession) === 'EXACT';
      // Đã được gán cả sự kiện thì ô theo suất chỉ hiện đã chọn, không đổi được ở đây.
      if (covers(row.assignments, eventId, scopeSession) === 'WHOLE_EVENT') return false;
      return was !== checked.has(row.userId);
    });
    if (changed.length === 0) {
      toast.show({ tone: 'success', message: 'Không có thay đổi nào' });
      return;
    }
    setSaving(true);
    try {
      for (const row of changed) {
        await save.mutateAsync({
          userId: row.userId,
          targets: toggleScope(row.assignments, eventId, scopeSession, checked.has(row.userId)),
        });
      }
      toast.show({ tone: 'success', message: `Đã cập nhật phân công của ${changed.length} người` });
    } catch (error) {
      toast.showError(error instanceof ApiError ? error : null);
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) {
    return (
      <>
        <PageHeader title="Phân công soát vé" />
        <EmptyState
          title="Bạn không có quyền phân công"
          description="Chỉ chủ tổ chức và quản trị viên gán được sự kiện cho Staff."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Phân công soát vé"
        description="Gán sự kiện hoặc từng suất cho thành viên có vai Staff. Bạn và các quản lý sự kiện tự soát được mọi sự kiện, không cần gán."
        actions={
          <Button variant="secondary" onClick={() => router.push('/members')}>
            Thêm Staff ở mục Thành viên
          </Button>
        }
      />

      {staff.isError ? (
        <ErrorState
          error={staff.error instanceof ApiError ? staff.error : null}
          correlationId={staff.error instanceof ApiError ? staff.error.correlationId : null}
          onRetry={() => void staff.refetch()}
        />
      ) : rows.length === 0 && !staff.isPending ? (
        <EmptyState
          title="Tổ chức chưa có Staff nào"
          description="Nhờ nhân viên tự đăng ký tài khoản NexaTicket, rồi thêm họ ở mục Thành viên với vai Staff (soát vé)."
        />
      ) : (
        <>
          <Section
            title="Gán theo sự kiện"
            description="Chọn sự kiện (và suất nếu cần), tick những Staff sẽ soát vé, rồi Lưu."
          >
            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label="Sự kiện"
                  placeholder={eventOptions.length === 0 ? 'Không có sự kiện sắp diễn ra' : 'Chọn sự kiện'}
                  value={eventId}
                  options={eventOptions}
                  onChange={(event) => {
                    setEventId(event.target.value);
                    setSessionId('');
                  }}
                />
                {sessionOptions.length > 1 ? (
                  <Select
                    label="Suất"
                    placeholder="Cả sự kiện (mọi suất)"
                    value={sessionId}
                    options={sessionOptions}
                    onChange={(event) => setSessionId(event.target.value)}
                  />
                ) : null}
              </div>

              {eventId ? (
                <fieldset className="m-0 grid gap-2 border-0 p-0">
                  <legend className="mb-1 p-0 text-[13px] font-medium">Staff soát vé</legend>
                  {rows.map((row) => {
                    const whole = covers(row.assignments, eventId, scopeSession) === 'WHOLE_EVENT';
                    return (
                      <label key={row.userId} className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          disabled={whole}
                          checked={checked.has(row.userId)}
                          onChange={(change) =>
                            setChecked((current) => {
                              const next = new Set(current);
                              if (change.target.checked) next.add(row.userId);
                              else next.delete(row.userId);
                              return next;
                            })
                          }
                        />
                        <span>{displayName(row)}</span>
                        {row.email && row.fullName ? (
                          <span className="text-[13px] text-muted">{row.email}</span>
                        ) : null}
                        {whole ? <span className="text-[13px] text-muted">· đã gán cả sự kiện</span> : null}
                      </label>
                    );
                  })}
                  <div>
                    <Button onClick={() => void submit()} loading={saving}>
                      Lưu phân công
                    </Button>
                  </div>
                </fieldset>
              ) : null}
            </div>
          </Section>

          <Table<StaffMember>
            caption="Staff và phân công"
            loading={staff.isPending}
            rows={rows}
            rowKey={(row) => row.userId}
            emptyTitle="Chưa có Staff nào"
            columns={[
              {
                key: 'user',
                header: 'Staff',
                cell: (row) => (
                  <div className="grid gap-0.5">
                    <span>{displayName(row)}</span>
                    {row.fullName && row.email ? <span className="text-[13px] text-muted">{row.email}</span> : null}
                  </div>
                ),
              },
              {
                key: 'assignments',
                header: 'Được gán',
                cell: (row) =>
                  row.assignments.length === 0 ? (
                    <span className="text-muted">Chưa gán sự kiện nào</span>
                  ) : (
                    <div className="grid gap-1">
                      {row.assignments.map((assignment) => (
                        <span
                          key={`${assignment.eventId}:${assignment.eventSessionId ?? 'all'}`}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <span>
                            {assignment.eventTitle ?? eventTitles.get(assignment.eventId) ?? 'Sự kiện đã xoá'}
                            {assignment.eventSessionId && assignment.startsAt
                              ? ` · suất ${formatDate(assignment.startsAt)}`
                              : ''}
                          </span>
                          <Badge tone={STATUS_LABEL[assignment.status].tone}>
                            {STATUS_LABEL[assignment.status].label}
                          </Badge>
                          {assignment.status !== 'EXPIRED' && assignment.expiresAt ? (
                            <span className="text-[13px] text-muted">hết hạn {formatDate(assignment.expiresAt)}</span>
                          ) : null}
                        </span>
                      ))}
                    </div>
                  ),
              },
              {
                key: 'actions',
                header: '',
                cell: (row) => {
                  const items: ActionMenuItem[] = [
                    { label: 'Gán sự kiện', icon: <CalendarCheck />, onSelect: () => setEditing(row) },
                  ];
                  return (
                    <RowActions>
                      <ActionMenu label={`Thao tác với ${displayName(row)}`} items={items} />
                    </RowActions>
                  );
                },
              },
            ]}
          />
        </>
      )}

      <StaffAssignmentDialog
        organizationId={organizationId}
        member={editing ? { userId: editing.userId, name: displayName(editing), assignments: editing.assignments } : null}
        onClose={() => setEditing(null)}
      />

      <StaffShifts organizationId={organizationId} events={events.data} staff={rows} />

      <StaffHistory organizationId={organizationId} staff={rows} />
    </>
  );
}
