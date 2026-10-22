'use client';

import {
  ApiError,
  useAdminEvent,
  useCheckinGates,
  useCreateCheckinGate,
  useDeleteCheckinGate,
  useDeleteShift,
  useEventShifts,
  useHasPermission,
  useRenameCheckinGate,
  useSaveShift,
  type AdminEventRow,
  type CheckinShift,
  type ShiftState,
  type StaffMember,
} from '@nexaticket/ts-sdk';
import {
  DateTimeField,
  ActionMenu,
  Badge,
  Button,
  EmptyState,
  Input,
  Modal,
  RowActions,
  Section,
  Select,
  Table,
  formatDateTime,
  formatTime,
  isoToVnLocal,
  useToast,
  vnLocalToIso,
  type ActionMenuItem,
} from '@nexaticket/ui';
import { Pencil, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

const STATE: Record<ShiftState, { label: string; tone: 'success' | 'warn' | 'neutral' }> = {
  NOT_STARTED: { label: 'Chưa bắt đầu', tone: 'warn' },
  ACTIVE: { label: 'Đang trong ca', tone: 'success' },
  ENDED: { label: 'Đã kết thúc', tone: 'neutral' },
};

interface ShiftForm {
  shiftId?: string;
  eventSessionId: string;
  gateId: string;
  startsAt: string;
  endsAt: string;
  staffIds: string[];
}

/**
 * Ca trực: cổng của sự kiện, ca theo suất + cổng, và ai đang trực ở cổng nào.
 *
 * Nhân viên chỉ có vai soát vé CHỈ quét được khi đã bấm "Bắt đầu ca" ở một ca của đúng suất, và
 * cổng ghi vào lượt quét là cổng của ca. Chưa xếp ca nào là nhân viên chưa quét được gì — nên mục
 * này nằm ngay dưới bảng Nhân sự, nơi vừa cấp tài khoản.
 *
 * Giờ trong các ô nhập là giờ Việt Nam, như mọi ô giờ khác của khu quản trị.
 */
export function StaffShifts({
  organizationId,
  events,
  staff,
}: {
  organizationId: string;
  events: AdminEventRow[] | undefined;
  staff: StaffMember[];
}) {
  const toast = useToast();
  const canManage = useHasPermission('CATALOG_MANAGE', organizationId);
  const [chosenEventId, setChosenEventId] = useState('');
  const eventId = chosenEventId || events?.[0]?.id || '';

  const detail = useAdminEvent(canManage ? organizationId : null, eventId || null);
  const gates = useCheckinGates(canManage ? organizationId : null, eventId || null);
  const shifts = useEventShifts(canManage ? organizationId : null, eventId || null);

  const createGate = useCreateCheckinGate(organizationId, eventId);
  const renameGate = useRenameCheckinGate(organizationId, eventId);
  const deleteGate = useDeleteCheckinGate(organizationId, eventId);
  const saveShift = useSaveShift(organizationId, eventId);
  const deleteShift = useDeleteShift(organizationId, eventId);

  const [newGate, setNewGate] = useState('');
  const [form, setForm] = useState<ShiftForm | null>(null);
  const [renaming, setRenaming] = useState<{ gateId: string; name: string } | null>(null);

  const fail = (error: unknown) => toast.showError(error instanceof ApiError ? error : null);

  const staffName = useMemo(
    () => new Map(staff.map((member) => [member.userId, member.fullName ?? member.username ?? member.email ?? '—'])),
    [staff],
  );
  // Chỉ nhân viên đã được gán sự kiện này mới xếp vào ca được — backend cũng chặn y như vậy.
  const eligible = useMemo(() => staff.filter((member) => member.eventIds.includes(eventId)), [staff, eventId]);
  const sessions = useMemo(() => detail.data?.sessions ?? [], [detail.data]);
  const sessionLabel = useMemo(
    () => new Map(sessions.map((session) => [session.id, formatDateTime(session.startsAt)])),
    [sessions],
  );
  const onDuty = (shifts.data ?? []).filter((shift) => shift.onDuty.length > 0);

  if (!canManage) return null;

  const openNew = () => {
    const session = sessions[0];
    const start = session ? new Date(Date.parse(session.startsAt) - 60 * 60 * 1000).toISOString() : '';
    const end = session ? session.endsAt ?? new Date(Date.parse(session.startsAt) + 4 * 60 * 60 * 1000).toISOString() : '';
    setForm({
      eventSessionId: session?.id ?? '',
      gateId: gates.data?.[0]?.id ?? '',
      startsAt: isoToVnLocal(start),
      endsAt: isoToVnLocal(end),
      staffIds: [],
    });
  };

  const submitShift = () => {
    if (!form) return;
    const startsAt = vnLocalToIso(form.startsAt);
    const endsAt = vnLocalToIso(form.endsAt);
    if (!form.eventSessionId || !form.gateId || !startsAt || !endsAt) {
      toast.show({ tone: 'danger', message: 'Chọn suất, cổng và nhập đủ giờ bắt đầu / kết thúc' });
      return;
    }
    saveShift.mutate(
      {
        shiftId: form.shiftId,
        request: { eventSessionId: form.eventSessionId, gateId: form.gateId, startsAt, endsAt, staffIds: form.staffIds },
      },
      {
        onSuccess: () => {
          setForm(null);
          toast.show({ tone: 'success', message: form.shiftId ? 'Đã lưu ca' : 'Đã tạo ca' });
        },
        onError: fail,
      },
    );
  };

  return (
    <Section
      title="Ca trực"
      description="Xếp cổng và ca cho từng suất. Nhân viên chỉ quét được khi đã bấm “Bắt đầu ca” trong app NexaTicket Staff (sớm tối đa 30 phút)."
      actions={
        events && events.length > 0 ? (
          <Select
            label="Sự kiện"
            value={eventId}
            onChange={(change) => setChosenEventId(change.target.value)}
            options={events.map((event) => ({ value: event.id, label: event.title }))}
          />
        ) : null
      }
    >
      {!events || events.length === 0 ? (
        <EmptyState title="Chưa có sự kiện" description="Tạo sự kiện và suất diễn trước, rồi xếp ca ở đây." />
      ) : (
        <div className="grid gap-5">
          <div className="grid gap-2">
            <h3 className="m-0 text-[15px] font-semibold">Đang trực ngay lúc này</h3>
            {onDuty.length === 0 ? (
              <p className="m-0 text-[13px] text-muted">Chưa ai bấm bắt đầu ca ở sự kiện này.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {onDuty.flatMap((shift) =>
                  shift.onDuty.map((person) => (
                    <span
                      key={`${shift.id}-${person.userId}`}
                      className="rounded-nt border border-success px-3 py-1.5 text-[13px]"
                    >
                      <strong>{shift.gateName}</strong> · {staffName.get(person.userId) ?? 'Nhân viên'} · từ{' '}
                      {formatTime(person.startedAt)}
                    </span>
                  )),
                )}
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <h3 className="m-0 text-[15px] font-semibold">Cổng</h3>
            <div className="flex flex-wrap items-center gap-2">
              {(gates.data ?? []).map((gate) => (
                <span key={gate.id} className="inline-flex items-center gap-1 rounded-nt border border-border px-2 py-1 text-[13px]">
                  {gate.name}
                  <button
                    type="button"
                    className="cursor-pointer border-0 bg-transparent p-1 text-muted"
                    aria-label={`Đổi tên ${gate.name}`}
                    onClick={() => setRenaming({ gateId: gate.id, name: gate.name })}
                  >
                    <Pencil aria-hidden="true" className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    className="cursor-pointer border-0 bg-transparent p-1 text-danger-text"
                    aria-label={`Xoá ${gate.name}`}
                    onClick={() => deleteGate.mutate(gate.id, { onError: fail })}
                  >
                    <Trash2 aria-hidden="true" className="size-3.5" />
                  </button>
                </span>
              ))}
              <form
                className="flex items-end gap-2"
                onSubmit={(submit) => {
                  submit.preventDefault();
                  if (!newGate.trim()) return;
                  createGate.mutate(newGate.trim(), {
                    onSuccess: () => setNewGate(''),
                    onError: fail,
                  });
                }}
              >
                <Input label="Thêm cổng" value={newGate} onChange={(change) => setNewGate(change.target.value)} placeholder="VD: Cổng A" maxLength={40} />
                <Button type="submit" variant="secondary" loading={createGate.isPending}>
                  Thêm
                </Button>
              </form>
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="m-0 text-[15px] font-semibold">Ca theo suất</h3>
              <Button onClick={openNew} disabled={sessions.length === 0 || (gates.data ?? []).length === 0}>
                Tạo ca
              </Button>
            </div>
            {sessions.length === 0 ? (
              <p className="m-0 text-[13px] text-muted">Sự kiện chưa có suất diễn nào.</p>
            ) : (gates.data ?? []).length === 0 ? (
              <p className="m-0 text-[13px] text-muted">Thêm ít nhất một cổng trước khi tạo ca.</p>
            ) : null}
            <Table<CheckinShift>
              caption="Ca trực của sự kiện"
              loading={shifts.isPending}
              rows={shifts.data ?? []}
              rowKey={(row) => row.id}
              emptyTitle="Chưa có ca nào"
              columns={[
                { key: 'session', header: 'Suất', cell: (row) => sessionLabel.get(row.eventSessionId) ?? '—' },
                { key: 'gate', header: 'Cổng', cell: (row) => row.gateName },
                {
                  key: 'time',
                  header: 'Giờ ca',
                  cell: (row) => `${formatDateTime(row.startsAt)} – ${formatTime(row.endsAt)}`,
                },
                {
                  key: 'staff',
                  header: 'Nhân viên',
                  cell: (row) =>
                    row.staffIds.length === 0 ? (
                      <span className="text-muted">Chưa có ai</span>
                    ) : (
                      <div className="grid gap-0.5">
                        {row.staffIds.map((id) => {
                          const duty = row.onDuty.find((person) => person.userId === id);
                          return (
                            <span key={id}>
                              {staffName.get(id) ?? 'Nhân viên'}
                              {duty ? <span className="text-[13px] text-success-text"> · đang trực từ {formatTime(duty.startedAt)}</span> : null}
                            </span>
                          );
                        })}
                      </div>
                    ),
                },
                {
                  key: 'state',
                  header: 'Trạng thái',
                  cell: (row) => <Badge tone={STATE[row.state].tone}>{STATE[row.state].label}</Badge>,
                },
                {
                  key: 'actions',
                  header: '',
                  cell: (row) => {
                    const items: ActionMenuItem[] = [
                      {
                        label: 'Sửa ca',
                        icon: <Pencil />,
                        onSelect: () =>
                          setForm({
                            shiftId: row.id,
                            eventSessionId: row.eventSessionId,
                            gateId: row.gateId,
                            startsAt: isoToVnLocal(row.startsAt),
                            endsAt: isoToVnLocal(row.endsAt),
                            staffIds: row.staffIds,
                          }),
                      },
                      {
                        label: 'Xoá ca',
                        icon: <Trash2 />,
                        tone: 'danger' as const,
                        onSelect: () => deleteShift.mutate(row.id, { onError: fail }),
                      },
                    ];
                    return (
                      <RowActions>
                        <ActionMenu label={`Thao tác với ca ${row.gateName}`} items={items} />
                      </RowActions>
                    );
                  },
                },
              ]}
            />
          </div>
        </div>
      )}

      <Modal
        open={form !== null}
        onClose={() => setForm(null)}
        title={form?.shiftId ? 'Sửa ca trực' : 'Tạo ca trực'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setForm(null)}>
              Huỷ
            </Button>
            <Button onClick={submitShift} loading={saveShift.isPending}>
              Lưu
            </Button>
          </>
        }
      >
        {form ? (
          <div className="grid gap-4">
            <Select
              label="Suất"
              value={form.eventSessionId}
              disabled={Boolean(form.shiftId)}
              onChange={(change) => setForm({ ...form, eventSessionId: change.target.value })}
              options={sessions.map((session) => ({ value: session.id, label: formatDateTime(session.startsAt) }))}
            />
            <Select
              label="Cổng"
              value={form.gateId}
              onChange={(change) => setForm({ ...form, gateId: change.target.value })}
              options={(gates.data ?? []).map((gate) => ({ value: gate.id, label: gate.name }))}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <DateTimeField
                label="Bắt đầu ca (giờ Việt Nam)"
                value={form.startsAt}
                onChange={(startsAt) => setForm({ ...form, startsAt })}
                required
              />
              <DateTimeField
                label="Kết thúc ca (giờ Việt Nam)"
                value={form.endsAt}
                onChange={(endsAt) => setForm({ ...form, endsAt })}
                required
              />
            </div>
            <fieldset className="m-0 grid gap-2 border-0 p-0">
              <legend className="mb-1 p-0 text-[13px] font-medium">Nhân viên trong ca</legend>
              {eligible.length === 0 ? (
                <p className="m-0 text-[13px] text-muted">
                  Chưa có nhân viên nào được gán sự kiện này. Gán ở bảng Nhân sự phía trên trước.
                </p>
              ) : (
                eligible.map((member) => (
                  <label key={member.userId} className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.staffIds.includes(member.userId)}
                      onChange={(change) =>
                        setForm({
                          ...form,
                          staffIds: change.target.checked
                            ? [...form.staffIds, member.userId]
                            : form.staffIds.filter((id) => id !== member.userId),
                        })
                      }
                    />
                    <span>
                      {member.fullName ?? member.username ?? member.email}
                      {member.username ? <span className="font-mono text-[13px] text-muted"> · {member.username}</span> : null}
                    </span>
                  </label>
                ))
              )}
            </fieldset>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={renaming !== null}
        onClose={() => setRenaming(null)}
        title="Đổi tên cổng"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenaming(null)}>
              Huỷ
            </Button>
            <Button
              loading={renameGate.isPending}
              onClick={() =>
                renaming &&
                renameGate.mutate(renaming, {
                  onSuccess: () => setRenaming(null),
                  onError: fail,
                })
              }
            >
              Lưu
            </Button>
          </>
        }
      >
        {renaming ? (
          <Input
            label="Tên cổng"
            value={renaming.name}
            maxLength={40}
            onChange={(change) => setRenaming({ ...renaming, name: change.target.value })}
          />
        ) : null}
      </Modal>
    </Section>
  );
}
