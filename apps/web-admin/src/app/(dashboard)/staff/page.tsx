'use client';

import {
  ApiError,
  useAdminEvents,
  useCancelStaffInvitation,
  useHasPermission,
  useInviteStaff,
  useRemoveMember,
  useResendStaffInvitation,
  useSetStaffEvents,
  useStaff,
  type AdminEventRow,
  type OrganizationSummary,
  type StaffMember,
  type StaffStatus,
} from '@nexaticket/ts-sdk';
import {
  ActionMenu,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  RowActions,
  Table,
  formatDate,
  useToast,
  type ActionMenuItem,
} from '@nexaticket/ui';
import { CalendarCheck, MailX, Send, UserMinus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { OrganizationGate } from '@/components/OrganizationGate';
import { StaffHistory } from './staff-history';

const STATUS: Record<StaffStatus, { label: string; tone: 'success' | 'warn' | 'danger' }> = {
  ACTIVE: { label: 'Đã kích hoạt', tone: 'success' },
  INVITED: { label: 'Đã mời', tone: 'warn' },
  EXPIRED: { label: 'Link hết hạn', tone: 'danger' },
  SEND_FAILED: { label: 'Lỗi gửi thư', tone: 'danger' },
};

/**
 * A-STAFF — nhân viên soát vé của tổ chức.
 *
 * <h3>Vì sao tách khỏi trang Thành viên</h3>
 *
 * Thành viên khác được mời bằng mã và tự mang tài khoản tới. Nhân viên soát vé thì không tự đăng
 * ký: tài khoản được tạo sẵn ở đây, thư mời mang liên kết để chính họ đặt mật khẩu, và họ chỉ soát
 * được những sự kiện được gán. Ba điều đó không có ở vai trò nào khác.
 *
 * <h3>Ai KHÔNG nằm trong bảng này</h3>
 *
 * Chủ tổ chức, quản trị và quản lý sự kiện tự soát được mọi sự kiện của tổ chức, nên không cần —
 * và không có — dòng nào ở đây.
 */
export default function StaffPage() {
  return (
    <OrganizationGate title="Nhân sự soát vé">
      {(organization) => <StaffContent organization={organization} />}
    </OrganizationGate>
  );
}

function StaffContent({ organization }: { organization: OrganizationSummary }) {
  const toast = useToast();
  const organizationId = organization.id;
  const canManage = useHasPermission('ORG_MEMBERS_MANAGE', organizationId);

  // Backend đòi ORG_MEMBERS_MANAGE cho cả bảng. Không gọi khi thiếu quyền, nếu không người quản lý
  // sự kiện mở trang này sẽ thấy một khối lỗi 403 mà họ không làm gì được.
  const staff = useStaff(canManage ? organizationId : null);
  const events = useAdminEvents(canManage ? organizationId : null);

  const invite = useInviteStaff(organizationId);
  const setEvents = useSetStaffEvents(organizationId);
  const resend = useResendStaffInvitation(organizationId);
  const cancel = useCancelStaffInvitation(organizationId);
  const removeMember = useRemoveMember(organizationId);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEvents, setInviteEvents] = useState<string[]>([]);
  const [assigning, setAssigning] = useState<StaffMember | null>(null);
  const [assignEvents, setAssignEvents] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const eventTitles = useMemo(
    () => new Map((events.data ?? []).map((event) => [event.id, event.title])),
    [events.data],
  );

  const fail = (error: unknown) => toast.showError(error instanceof ApiError ? error : null);

  const submitInvite = (formData: FormData) => {
    invite.mutate(
      {
        fullName: String(formData.get('fullName') ?? '').trim(),
        email: String(formData.get('email') ?? '').trim(),
        eventIds: inviteEvents,
      },
      {
        onSuccess: (result) => {
          setInviteOpen(false);
          setInviteEvents([]);
          toast.show(INVITE_OUTCOME[result.outcome]);
        },
        onError: fail,
      },
    );
  };

  const submitAssign = () => {
    if (!assigning) return;
    setEvents.mutate(
      { userId: assigning.userId, eventIds: assignEvents },
      {
        onSuccess: () => {
          setAssigning(null);
          toast.show({ tone: 'success', message: 'Đã cập nhật sự kiện được gán' });
        },
        onError: fail,
      },
    );
  };

  if (!canManage) {
    return (
      <>
        <PageHeader title="Nhân sự soát vé" />
        <EmptyState
          title="Bạn không có quyền quản lý nhân sự"
          description="Chỉ chủ tổ chức và quản trị viên mời và gán được nhân viên soát vé."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Nhân sự soát vé"
        description="Mời nhân viên bằng email và gán sự kiện họ được soát. Bạn và các quản lý sự kiện tự soát được, không cần thêm ở đây."
        actions={
          <Button
            onClick={() => {
              setInviteEvents([]);
              setInviteOpen(true);
            }}
          >
            Mời nhân viên
          </Button>
        }
      />

      {staff.isError ? (
        <ErrorState
          error={staff.error instanceof ApiError ? staff.error : null}
          correlationId={staff.error instanceof ApiError ? staff.error.correlationId : null}
          onRetry={() => void staff.refetch()}
        />
      ) : (
        <Table<StaffMember>
          caption="Nhân viên soát vé"
          loading={staff.isPending}
          rows={staff.data ?? []}
          rowKey={(row) => row.userId}
          emptyTitle="Chưa có nhân viên soát vé nào"
          columns={[
            {
              key: 'user',
              header: 'Nhân viên',
              cell: (row) => (
                <div className="grid gap-0.5">
                  <span>{row.fullName ?? row.email}</span>
                  {row.fullName ? <span className="text-[13px] text-muted">{row.email}</span> : null}
                </div>
              ),
            },
            {
              key: 'status',
              header: 'Trạng thái',
              cell: (row) => (
                <div className="grid gap-0.5">
                  <span>
                    <Badge tone={STATUS[row.status].tone}>{STATUS[row.status].label}</Badge>
                  </span>
                  {row.status === 'INVITED' && row.expiresAt ? (
                    <span className="text-[13px] text-muted">Link hết hạn {formatDate(row.expiresAt)}</span>
                  ) : null}
                </div>
              ),
            },
            {
              key: 'events',
              header: 'Sự kiện được soát',
              cell: (row) =>
                row.eventIds.length === 0 ? (
                  <span className="text-muted">Chưa gán sự kiện nào</span>
                ) : (
                  <div className="grid gap-0.5">
                    {row.eventIds.map((id) => (
                      <span key={id}>{eventTitles.get(id) ?? 'Sự kiện đã xoá'}</span>
                    ))}
                  </div>
                ),
            },
            {
              key: 'invited',
              header: 'Người mời',
              cell: (row) =>
                row.invitedAt ? (
                  <div className="grid gap-0.5">
                    <span>{row.invitedBy ?? '—'}</span>
                    <span className="text-[13px] text-muted">{formatDate(row.invitedAt)}</span>
                  </div>
                ) : (
                  <span className="text-muted">—</span>
                ),
            },
            {
              key: 'actions',
              header: '',
              cell: (row) => {
                const pending = row.status !== 'ACTIVE';
                const items: ActionMenuItem[] = [
                  {
                    label: 'Gán sự kiện',
                    icon: <CalendarCheck />,
                    onSelect: () => {
                      setAssignEvents(row.eventIds);
                      setAssigning(row);
                    },
                  },
                  ...(pending
                    ? [
                        {
                          label: 'Gửi lại lời mời',
                          icon: <Send />,
                          onSelect: () =>
                            setConfirm({
                              title: 'Gửi lại lời mời?',
                              body: `Một thư mới sẽ tới ${row.email}. Liên kết trong thư cũ không còn dùng được.`,
                              confirmLabel: 'Gửi lại',
                              run: () =>
                                resend.mutate(row.userId, {
                                  onSuccess: () => {
                                    setConfirm(null);
                                    toast.show({ tone: 'success', message: 'Đã gửi lại lời mời' });
                                  },
                                  onError: (error) => {
                                    setConfirm(null);
                                    fail(error);
                                  },
                                }),
                            }),
                        },
                        {
                          label: 'Huỷ lời mời',
                          icon: <MailX />,
                          tone: 'danger' as const,
                          onSelect: () =>
                            setConfirm({
                              title: 'Huỷ lời mời?',
                              body: `Tài khoản chưa kích hoạt của ${row.email} sẽ bị xoá cùng mọi sự kiện đã gán. Liên kết trong thư không còn dùng được.`,
                              confirmLabel: 'Huỷ lời mời',
                              run: () =>
                                cancel.mutate(row.userId, {
                                  onSuccess: () => {
                                    setConfirm(null);
                                    toast.show({ tone: 'success', message: 'Đã huỷ lời mời' });
                                  },
                                  onError: (error) => {
                                    setConfirm(null);
                                    fail(error);
                                  },
                                }),
                            }),
                        },
                      ]
                    : [
                        {
                          label: 'Gỡ khỏi tổ chức',
                          icon: <UserMinus />,
                          tone: 'danger' as const,
                          onSelect: () =>
                            setConfirm({
                              title: 'Gỡ khỏi tổ chức?',
                              // Nói rõ thứ còn lại: người gỡ cần biết lịch sử quét không mất.
                              body: `${row.email} mất quyền soát vé ngay lập tức. Tài khoản và lịch sử quét của họ được giữ lại để đối soát.`,
                              confirmLabel: 'Gỡ nhân viên',
                              run: () =>
                                removeMember.mutate(row.userId, {
                                  onSuccess: () => {
                                    setConfirm(null);
                                    toast.show({ tone: 'success', message: 'Đã gỡ nhân viên' });
                                  },
                                  onError: (error) => {
                                    setConfirm(null);
                                    fail(error);
                                  },
                                }),
                            }),
                        },
                      ]),
                ];
                return (
                  <RowActions>
                    <ActionMenu label={`Thao tác với ${row.fullName ?? row.email}`} items={items} />
                  </RowActions>
                );
              },
            },
          ]}
        />
      )}

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Mời nhân viên soát vé"
        footer={
          <>
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>
              Huỷ
            </Button>
            <Button type="submit" form="invite-staff" loading={invite.isPending}>
              Mời
            </Button>
          </>
        }
      >
        <form id="invite-staff" action={submitInvite} className="grid gap-4">
          <Input name="fullName" label="Họ tên" required maxLength={120} />
          <Input name="email" type="email" label="Email" required />
          <EventChecklist events={events.data} selected={inviteEvents} onChange={setInviteEvents} />
          <p className="m-0 text-[13px] text-muted">
            Nhân viên nhận một thư có liên kết dùng một lần để tự đặt mật khẩu. Bạn không thấy và
            không đặt được mật khẩu của họ.
          </p>
        </form>
      </Modal>

      <Modal
        open={assigning !== null}
        onClose={() => setAssigning(null)}
        title="Gán sự kiện"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAssigning(null)}>
              Huỷ
            </Button>
            <Button onClick={submitAssign} loading={setEvents.isPending}>
              Lưu
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <p className="m-0 text-muted">{assigning?.fullName ?? assigning?.email}</p>
          <EventChecklist events={events.data} selected={assignEvents} onChange={setAssignEvents} />
          <p className="m-0 text-[13px] text-muted">
            Bỏ chọn một sự kiện là gỡ quyền soát vé của người này ở sự kiện đó. Tài khoản và lịch sử
            quét được giữ nguyên.
          </p>
        </div>
      </Modal>

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm?.title ?? ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Đóng
            </Button>
            <Button
              onClick={() => confirm?.run()}
              loading={resend.isPending || cancel.isPending || removeMember.isPending}
            >
              {confirm?.confirmLabel ?? 'Xác nhận'}
            </Button>
          </>
        }
      >
        <p className="m-0">{confirm?.body}</p>
      </Modal>

      {canManage ? <StaffHistory organizationId={organizationId} staff={staff.data ?? []} /> : null}
    </>
  );
}

/** Danh sách sự kiện có ô chọn. Sự kiện tạo sau này không tự được gán — phải vào đây chọn. */
function EventChecklist({
  events,
  selected,
  onChange,
}: {
  events: AdminEventRow[] | undefined;
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  if (!events) return <p className="m-0 text-muted">Đang tải sự kiện...</p>;
  if (events.length === 0) {
    return <p className="m-0 text-muted">Tổ chức chưa có sự kiện nào. Có thể gán sau.</p>;
  }
  return (
    <fieldset className="m-0 grid gap-2 border-0 p-0">
      <legend className="mb-1 p-0 text-[13px] font-medium">Sự kiện được soát</legend>
      <div className="grid max-h-56 gap-2 overflow-y-auto">
        {events.map((event) => (
          <label key={event.id} className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={selected.includes(event.id)}
              onChange={(change) =>
                onChange(
                  change.target.checked
                    ? [...selected, event.id]
                    : selected.filter((id) => id !== event.id),
                )
              }
            />
            <span className="grid gap-0.5">
              <span>{event.title}</span>
              {event.venueName ? <span className="text-[13px] text-muted">{event.venueName}</span> : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const INVITE_OUTCOME: Record<
  'INVITED' | 'SEND_FAILED' | 'PENDING' | 'ALREADY_STAFF',
  { tone: 'success' | 'danger'; message: string }
> = {
  INVITED: { tone: 'success', message: 'Đã gửi thư mời' },
  SEND_FAILED: {
    tone: 'danger',
    message: 'Đã tạo tài khoản nhưng thư chưa gửi được. Dùng "Gửi lại lời mời".',
  },
  PENDING: {
    tone: 'success',
    message: 'Người này đã được mời và chưa kích hoạt. Đã gán thêm sự kiện, không gửi thư trùng.',
  },
  ALREADY_STAFF: { tone: 'success', message: 'Người này đã là nhân viên soát vé. Đã gán thêm sự kiện.' },
};

/** Hộp xác nhận dùng chung: mỗi thao tác nói đúng hệ quả của nó, không hỏi "Bạn có chắc không?". */
interface ConfirmState {
  title: string;
  body: string;
  confirmLabel: string;
  run: () => void;
}
