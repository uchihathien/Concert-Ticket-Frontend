'use client';

import {
  ApiError,
  ORGANIZATION_ROLES,
  useAddMember,
  useChangeMemberRole,
  useHasPermission,
  useInviteMember,
  useLookupMember,
  useOrganizationMembers,
  usePendingInvitations,
  useRemoveMember,
  useRevokeInvitation,
  useRevokeMemberSessions,
  useSendMemberPasswordReset,
  useStaff,
  type Member,
  type MemberCandidate,
  type OrganizationRole,
  type OrganizationSummary,
  type PendingInvitation,
} from '@nexaticket/ts-sdk';
import {
  Badge,
  Button,
  CopyField,
  ErrorState,
  FilterBar,
  Input,
  Modal,
  PageHeader,
  RowActions,
  ActionMenu,
  type ActionMenuItem,
  Section,
  Select,
  Table,
  foldText,
  formatDate,
  formatNumber,
  matchesText,
  roleLabel,
  roleTone,
  useToast,
} from '@nexaticket/ui';
import { CalendarCheck, KeyRound, LogOut, UserCog, UserMinus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { OrganizationGate } from '@/components/OrganizationGate';
import { StaffAssignmentDialog } from '@/components/StaffAssignmentDialog';

const ROLE_OPTIONS = ORGANIZATION_ROLES.map((role) => ({ value: role, label: roleLabel(role) }));

/**
 * Vai trò mời được bằng mã ở trang này.
 *
 * Staff (soát vé) KHÔNG nằm trong đó: Staff được thêm trực tiếp bằng "Thêm thành viên" (tìm đúng
 * email/SĐT của tài khoản họ tự đăng ký). Backend từ chối vai trò này trên đường lời mời bằng mã,
 * nên để nó trong danh sách là mời người dùng bấm vào một cánh cửa khoá.
 */
const INVITE_ROLE_OPTIONS = ROLE_OPTIONS.filter((option) => option.value !== 'CHECKIN_STAFF');

/**
 * Trang đăng nhập/đăng ký của web khách — gửi cho người chưa có tài khoản. Trang /login ở đó có nút
 * "Tạo tài khoản mới" dẫn sang Keycloak.
 */
const REGISTER_URL = `${(process.env.NEXT_PUBLIC_WEB_CUSTOMER_URL ?? 'http://localhost:3000').replace(/\/$/, '')}/login`;

/** Cùng danh sách vai trò với form mời, dùng lại thay vì gõ lại — hai bản sao sẽ lệch. */
const MEMBER_ROLE_FILTERS = ROLE_OPTIONS;

/**
 * A-MEMBERS — thành viên của tổ chức, lời mời, và các thao tác lên tài khoản của họ.
 *
 * <h3>Giao diện hỏi QUYỀN, không hỏi tên vai trò</h3>
 *
 * Mọi nút ở đây bọc trong `useHasPermission(...)`. Viết `role === 'ORG_ADMIN' || role ===
 * 'ORG_OWNER'` thì nhanh hơn, nhưng đó là bản sao thứ hai của ma trận phân quyền — đặt ở nơi
 * backend không nhìn thấy. Thêm một vai trò ở backend là bốn app hiện sai cho tới khi có người nhớ
 * ra phải sửa cả bên này.
 *
 * <h3>Ẩn nút không phải là chặn</h3>
 *
 * Chặn thật nằm ở backend (`TenantContext.requirePermission`) và vẫn chạy dù giao diện có hỏi hay
 * không. Ẩn nút là để người dùng khỏi đâm vào một cánh cửa khoá, chứ không phải để khoá nó.
 */
export default function MembersPage() {
  return (
    <OrganizationGate title="Thành viên">
      {(organization) => <MembersContent organization={organization} />}
    </OrganizationGate>
  );
}

function MembersContent({ organization }: { organization: OrganizationSummary }) {
  const toast = useToast();
  const organizationId = organization.id;

  const canManage = useHasPermission('ORG_MEMBERS_MANAGE', organizationId);
  const canRevokeSessions = useHasPermission('ORG_SESSION_REVOKE', organizationId);

  const members = useOrganizationMembers(organizationId);
  // Danh sách lời mời đòi ORG_ADMIN trở lên ở backend. Không gọi khi thiếu quyền, nếu không màn
  // hình của một EVENT_MANAGER sẽ hiện một khối lỗi 403 mà họ không làm gì được.
  const invitations = usePendingInvitations(canManage ? organizationId : null);

  const invite = useInviteMember(organizationId);
  const changeRole = useChangeMemberRole(organizationId);
  const removeMember = useRemoveMember(organizationId);
  const revokeSessions = useRevokeMemberSessions(organizationId);
  const sendPasswordReset = useSendMemberPasswordReset(organizationId);
  const revokeInvitation = useRevokeInvitation(organizationId);

  const [memberQuery, setMemberQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [editing, setEditing] = useState<Member | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [adding, setAdding] = useState(false);
  const [assigning, setAssigning] = useState<Member | null>(null);

  // Phân công soát vé để mở hộp "Gán sự kiện" ngay từ dòng Staff. Chỉ gọi khi có quyền quản lý.
  const staff = useStaff(canManage ? organizationId : null);

  /**
   * Lọc tại chỗ: một tổ chức có vài chục thành viên và `GET /members` trả hết trong một lượt.
   * Đẩy sang backend ở quy mô này chỉ thêm một vòng khứ hồi cho mỗi phím gõ.
   */
  const visibleMembers = useMemo(() => {
    const needle = foldText(memberQuery.trim());
    return (members.data ?? []).filter((row) => {
      if (roleFilter && row.role !== roleFilter) return false;
      return matchesText(needle, [row.email, row.fullName, row.userId]);
    });
  }, [members.data, memberQuery, roleFilter]);

  const fail = (error: unknown) => toast.showError(error instanceof ApiError ? error : null);

  const submitInvite = (formData: FormData) => {
    invite.mutate(
      {
        email: String(formData.get('email') ?? '').trim(),
        role: String(formData.get('role') ?? 'EVENT_MANAGER') as OrganizationRole,
      },
      {
        onSuccess: (created) => {
          setFormOpen(false);
          setToken(created.token);
        },
        onError: fail,
      },
    );
  };

  const submitRole = (formData: FormData) => {
    if (!editing) return;
    changeRole.mutate(
      { userId: editing.userId, role: String(formData.get('role')) as OrganizationRole },
      {
        onSuccess: () => {
          setEditing(null);
          toast.show({ tone: 'success', message: 'Đã đổi vai trò' });
        },
        onError: fail,
      },
    );
  };

  return (
    <>
      <PageHeader
        title="Thành viên"
        description={`Người có quyền làm việc trong ${organization.name}.`}
        actions={
          canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setFormOpen(true)}>
                Mời bằng mã
              </Button>
              <Button onClick={() => setAdding(true)}>Thêm thành viên</Button>
            </div>
          ) : undefined
        }
      />

      {members.isError ? (
        <ErrorState
          error={members.error instanceof ApiError ? members.error : null}
          correlationId={members.error instanceof ApiError ? members.error.correlationId : null}
          onRetry={() => void members.refetch()}
        />
      ) : (
        <>
          <FilterBar
            count={`${formatNumber(visibleMembers.length)} / ${formatNumber(
              (members.data ?? []).length,
            )} thành viên`}
            actions={
              memberQuery || roleFilter ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setMemberQuery('');
                    setRoleFilter('');
                  }}
                >
                  Xoá bộ lọc
                </Button>
              ) : undefined
            }
          >
            <Input
              label="Tìm thành viên"
              placeholder="Tên hoặc email"
              value={memberQuery}
              onChange={(event) => setMemberQuery(event.target.value)}
            />
            <Select
              label="Vai trò"
              placeholder="Mọi vai trò"
              value={roleFilter}
              options={MEMBER_ROLE_FILTERS}
              onChange={(event) => setRoleFilter(event.target.value)}
            />
          </FilterBar>

          <Table<Member>
            caption="Danh sách thành viên"
            loading={members.isPending}
            rows={visibleMembers}
          rowKey={(row) => row.userId}
          emptyTitle="Chưa có thành viên nào"
          columns={[
            {
              key: 'user',
              header: 'Người dùng',
              // Email là thứ nhận ra được người; id chỉ có nghĩa khi đi báo lỗi. Bảng cũ hiện mỗi
              // UUID, nên không ai dám bấm nút gỡ.
              cell: (row) => (
                <div className="grid gap-0.5">
                  <span>{row.fullName ?? row.email ?? row.userId}</span>
                  {row.fullName && row.email ? (
                    <span className="text-[13px] text-muted">{row.email}</span>
                  ) : null}
                </div>
              ),
            },
            {
              key: 'role',
              header: 'Vai trò',
              cell: (row) => <Badge tone={roleTone(row.role)}>{roleLabel(row.role)}</Badge>,
            },
            { key: 'joined', header: 'Tham gia', cell: (row) => formatDate(row.joinedAt) },
            {
              key: 'actions',
              header: '',
              cell: (row) => {
                const resetPassword = () =>
                  setConfirm({
                    title: 'Gửi thư đặt lại mật khẩu?',
                    // Nói rõ hệ thống làm gì và KHÔNG làm gì: người bấm cần biết mình không hề
                    // nhìn thấy mật khẩu mới.
                    body: `Keycloak sẽ gửi một liên kết dùng một lần tới ${row.email ?? 'hộp thư của họ'}. Bạn không thấy được mật khẩu mới, và mật khẩu hiện tại vẫn dùng được cho tới khi họ đổi.`,
                    confirmLabel: 'Gửi thư',
                    run: () =>
                      sendPasswordReset.mutate(row.userId, {
                        onSuccess: () => {
                          setConfirm(null);
                          toast.show({ tone: 'success', message: 'Đã gửi thư đặt lại mật khẩu' });
                        },
                        onError: fail,
                      }),
                  });
                const revoke = () =>
                  setConfirm({
                    title: 'Buộc đăng xuất?',
                    body: 'Mọi thiết bị đang đăng nhập bằng tài khoản này sẽ bị đẩy ra ngay. Họ vẫn đăng nhập lại được — đây không phải khoá tài khoản.',
                    confirmLabel: 'Đăng xuất mọi thiết bị',
                    run: () =>
                      revokeSessions.mutate(
                        { userId: row.userId },
                        {
                          onSuccess: () => {
                            setConfirm(null);
                            toast.show({ tone: 'success', message: 'Đã thu hồi phiên đăng nhập' });
                          },
                          onError: fail,
                        },
                      ),
                  });
                const remove = () =>
                  setConfirm({
                    title: 'Gỡ khỏi tổ chức?',
                    body:
                      row.role === 'CHECKIN_STAFF'
                        ? `${row.email ?? row.userId} sẽ mất quyền truy cập ngay lập tức, và các phân công soát vé còn hiệu lực của họ bị gỡ theo. Tài khoản và lịch sử quét được giữ lại.`
                        : `${row.email ?? row.userId} sẽ mất quyền truy cập ngay lập tức. Tài khoản của họ không bị xoá.`,
                    confirmLabel: 'Gỡ thành viên',
                    run: () =>
                      removeMember.mutate(row.userId, {
                        onSuccess: () => {
                          setConfirm(null);
                          toast.show({ tone: 'success', message: 'Đã gỡ thành viên' });
                        },
                        onError: fail,
                      }),
                  });

                // Quyền quyết định mục nào xuất hiện, như các nút trước đây. Không còn mục nào thì
                // ActionMenu không vẽ gì.
                const items: ActionMenuItem[] = [
                  ...(canManage && row.role === 'CHECKIN_STAFF'
                    ? [{ label: 'Gán sự kiện', icon: <CalendarCheck />, onSelect: () => setAssigning(row) }]
                    : []),
                  ...(canManage
                    ? [
                        { label: 'Đổi vai trò', icon: <UserCog />, onSelect: () => setEditing(row) },
                        { label: 'Đặt lại mật khẩu', icon: <KeyRound />, onSelect: resetPassword },
                      ]
                    : []),
                  ...(canRevokeSessions
                    ? [{ label: 'Đăng xuất mọi thiết bị', icon: <LogOut />, onSelect: revoke }]
                    : []),
                  ...(canManage
                    ? [{ label: 'Gỡ khỏi tổ chức', icon: <UserMinus />, onSelect: remove, tone: 'danger' as const }]
                    : []),
                ];

                return (
                  <RowActions>
                    <ActionMenu
                      label={`Thao tác với ${row.fullName ?? row.email ?? 'thành viên'}`}
                      items={items}
                    />
                  </RowActions>
                );
              },
            },
          ]}
          />
        </>
      )}

      {canManage && (invitations.data?.length ?? 0) > 0 ? (
        <Section
          title="Lời mời đang chờ"
          description="Người đã được mời nhưng chưa nhận. Thu hồi thì mã cũ hết hiệu lực ngay."
        >
          <Table<PendingInvitation>
            caption="Lời mời đang chờ"
            loading={invitations.isPending}
            rows={invitations.data ?? []}
            rowKey={(row) => row.id}
            emptyTitle="Không có lời mời nào đang chờ"
            columns={[
              { key: 'email', header: 'Email', cell: (row) => row.email },
              {
                key: 'role',
                header: 'Vai trò',
                cell: (row) => roleLabel(row.role),
              },
              {
                key: 'expires',
                header: 'Hết hạn',
                cell: (row) =>
                  row.expired ? <Badge tone="danger">Đã hết hạn</Badge> : formatDate(row.expiresAt),
              },
              {
                key: 'actions',
                header: '',
                cell: (row) => (
                  <RowActions>
                    <Button
                      variant="danger-soft"
                      onClick={() =>
                        revokeInvitation.mutate(row.id, {
                          onSuccess: () =>
                            toast.show({ tone: 'success', message: 'Đã thu hồi lời mời' }),
                          onError: fail,
                        })
                      }
                    >
                      Thu hồi
                    </Button>
                  </RowActions>
                ),
              },
            ]}
          />
        </Section>
      ) : null}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Mời thành viên"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Huỷ
            </Button>
            <Button type="submit" form="invite-member" loading={invite.isPending}>
              Gửi lời mời
            </Button>
          </>
        }
      >
        <form id="invite-member" action={submitInvite} className="grid gap-4">
          <Input name="email" type="email" label="Email" required />
          <Select name="role" label="Vai trò" required options={INVITE_ROLE_OPTIONS} />
          <p className="m-0 text-[13px] text-muted">
            Người đã có tài khoản NexaTicket thì dùng &quot;Thêm thành viên&quot; — có hiệu lực ngay, không cần mã. Staff
            (soát vé) chỉ thêm được theo cách đó.
          </p>
        </form>
      </Modal>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Đổi vai trò"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Huỷ
            </Button>
            <Button type="submit" form="change-role" loading={changeRole.isPending}>
              Lưu
            </Button>
          </>
        }
      >
        <form id="change-role" action={submitRole} className="grid gap-4">
          <p className="m-0 text-muted">{editing?.email ?? editing?.userId}</p>
          <Select
            name="role"
            label="Vai trò"
            required
            defaultValue={editing?.role}
            options={ROLE_OPTIONS}
          />
          <p className="m-0 text-[13px] text-muted">
            Chỉ chủ sở hữu mới phong được chủ sở hữu khác, và tổ chức luôn phải còn ít nhất một
            người ở vai trò đó. Đổi một Staff sang vai khác thì phân công soát vé còn hiệu lực của họ bị
            gỡ — vai quản lý soát được mọi sự kiện.
          </p>
        </form>
      </Modal>

      <Modal
        open={token !== null}
        onClose={() => setToken(null)}
        title="Đã tạo lời mời"
        footer={<Button onClick={() => setToken(null)}>Xong</Button>}
      >
        <p className="mt-0">
          Gửi mã dưới đây cho người được mời. Họ mở <code>/invitations/&lt;mã&gt;/accept</code> để
          nhận quyền.
        </p>
        {token ? <CopyField label="Mã lời mời" value={token} /> : null}
        <p className="mb-0 text-[13px] text-muted">Mã chỉ hiện đúng một lần.</p>
      </Modal>

      <AddMemberModal organizationId={organizationId} open={adding} onClose={() => setAdding(false)} />

      <StaffAssignmentDialog
        organizationId={organizationId}
        member={
          assigning
            ? {
                userId: assigning.userId,
                name: assigning.fullName ?? assigning.email ?? assigning.userId,
                assignments: staff.data?.find((row) => row.userId === assigning.userId)?.assignments ?? [],
              }
            : null
        }
        onClose={() => setAssigning(null)}
      />

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm?.title ?? ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Huỷ
            </Button>
            <Button
              onClick={() => confirm?.run()}
              loading={
                removeMember.isPending || revokeSessions.isPending || sendPasswordReset.isPending
              }
            >
              {confirm?.confirmLabel ?? 'Xác nhận'}
            </Button>
          </>
        }
      >
        <p className="m-0">{confirm?.body}</p>
      </Modal>
    </>
  );
}

/**
 * Thêm một tài khoản đã đăng ký vào tổ chức.
 *
 * Hai bước có chủ ý: Tìm rồi mới Thêm. Bước Tìm hiện tên và email/SĐT đã che để người thêm nhận ra
 * đúng người trước khi cấp quyền — gõ nhầm một chữ trong email là cấp quyền cho người lạ. Chỉ khớp
 * chính xác, không gợi ý: ô này không phải công cụ tra cứu người dùng.
 */
function AddMemberModal({
  organizationId,
  open,
  onClose,
}: {
  organizationId: string;
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const lookup = useLookupMember(organizationId);
  const add = useAddMember(organizationId);
  const [contact, setContact] = useState('');
  const [role, setRole] = useState<OrganizationRole>('CHECKIN_STAFF');
  const [found, setFound] = useState<MemberCandidate | null>(null);
  const [notRegistered, setNotRegistered] = useState(false);

  const reset = () => {
    setContact('');
    setRole('CHECKIN_STAFF');
    setFound(null);
    setNotRegistered(false);
    lookup.reset();
  };

  const close = () => {
    reset();
    onClose();
  };

  const search = () => {
    setFound(null);
    setNotRegistered(false);
    lookup.mutate(contact.trim(), {
      onSuccess: setFound,
      onError: (error) => {
        if (error instanceof ApiError && error.code === 'USER_NOT_REGISTERED') setNotRegistered(true);
        else toast.showError(error instanceof ApiError ? error : null);
      },
    });
  };

  const submit = () => {
    add.mutate(
      { contact: contact.trim(), role },
      {
        onSuccess: () => {
          toast.show({ tone: 'success', message: `Đã thêm ${found?.fullName ?? 'thành viên'} với vai ${roleLabel(role)}` });
          close();
        },
        onError: (error) => toast.showError(error instanceof ApiError ? error : null),
      },
    );
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Thêm thành viên"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Huỷ
          </Button>
          <Button onClick={submit} disabled={!found || found.alreadyMember} loading={add.isPending}>
            Thêm
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (contact.trim()) search();
          }}
        >
          <div className="min-w-0 flex-1">
            <Input
              label="Email hoặc số điện thoại"
              placeholder="vd. lan.tran@gmail.com hoặc 0901234567"
              value={contact}
              onChange={(event) => {
                setContact(event.target.value);
                setFound(null);
                setNotRegistered(false);
              }}
              autoComplete="off"
              required
            />
          </div>
          <Button type="submit" variant="secondary" loading={lookup.isPending} disabled={!contact.trim()}>
            Tìm
          </Button>
        </form>

        {notRegistered ? (
          <div className="grid gap-2">
            <p className="m-0" role="status">
              Người này chưa có tài khoản NexaTicket. Hãy nhờ họ đăng ký trước rồi thêm lại.
            </p>
            <CopyField label="Link đăng ký" value={REGISTER_URL} />
          </div>
        ) : null}

        {found ? (
          <div className="grid gap-3">
            <div className="grid gap-0.5 rounded-nt border border-border p-3">
              <span className="font-medium">{found.fullName ?? 'Chưa đặt tên'}</span>
              <span className="text-[13px] text-muted">
                {[found.maskedEmail, found.maskedPhone].filter(Boolean).join(' · ')}
              </span>
              {found.alreadyMember && found.currentRole ? (
                <span className="text-[13px]">
                  Đã là thành viên với vai <Badge tone={roleTone(found.currentRole)}>{roleLabel(found.currentRole)}</Badge>.
                  Đổi vai ở bảng thành viên.
                </span>
              ) : null}
            </div>
            {found.alreadyMember ? null : (
              <Select
                label="Vai trò"
                value={role}
                options={ROLE_OPTIONS}
                onChange={(event) => setRole(event.target.value as OrganizationRole)}
              />
            )}
            {role === 'CHECKIN_STAFF' && !found.alreadyMember ? (
              <p className="m-0 text-[13px] text-muted">
                Staff chỉ soát vé được ở sự kiện bạn gán — gán ở trang Phân công soát vé, hoặc &quot;Gán sự kiện&quot;
                ở dòng của họ sau khi thêm.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

/**
 * Hộp xác nhận dùng chung cho ba thao tác.
 *
 * Ba thao tác này đều tác động tới tài khoản của người khác và không có nút hoàn tác, nên chúng
 * phải hỏi lại — và câu hỏi phải nói đúng hệ quả, không phải "Bạn có chắc không?".
 */
interface ConfirmState {
  title: string;
  body: string;
  confirmLabel: string;
  run: () => void;
}
