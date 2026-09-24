'use client';

import {
  ApiError,
  ORGANIZATION_ROLES,
  useChangeMemberRole,
  useHasPermission,
  useInviteMember,
  useOrganizationMembers,
  usePendingInvitations,
  useRemoveMember,
  useRevokeInvitation,
  useRevokeMemberSessions,
  useSendMemberPasswordReset,
  type Member,
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
import { useMemo, useState } from 'react';
import { OrganizationGate } from '@/components/OrganizationGate';

const ROLE_OPTIONS = ORGANIZATION_ROLES.map((role) => ({ value: role, label: roleLabel(role) }));

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
          canManage ? <Button onClick={() => setFormOpen(true)}>Mời thành viên</Button> : undefined
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
              cell: (row) => (
                <RowActions>
                  {canManage ? (
                    <>
                      <Button variant="ghost" onClick={() => setEditing(row)}>
                        Đổi vai trò
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          setConfirm({
                            title: 'Gửi thư đặt lại mật khẩu?',
                            // Nói rõ hệ thống làm gì và KHÔNG làm gì: người bấm cần biết mình
                            // không hề nhìn thấy mật khẩu mới.
                            body: `Keycloak sẽ gửi một liên kết dùng một lần tới ${row.email ?? 'hộp thư của họ'}. Bạn không thấy được mật khẩu mới, và mật khẩu hiện tại vẫn dùng được cho tới khi họ đổi.`,
                            confirmLabel: 'Gửi thư',
                            run: () =>
                              sendPasswordReset.mutate(row.userId, {
                                onSuccess: () => {
                                  setConfirm(null);
                                  toast.show({
                                    tone: 'success',
                                    message: 'Đã gửi thư đặt lại mật khẩu',
                                  });
                                },
                                onError: fail,
                              }),
                          })
                        }
                      >
                        Đặt lại mật khẩu
                      </Button>
                    </>
                  ) : null}

                  {canRevokeSessions ? (
                    <Button
                      variant="ghost"
                      onClick={() =>
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
                                  toast.show({
                                    tone: 'success',
                                    message: 'Đã thu hồi phiên đăng nhập',
                                  });
                                },
                                onError: fail,
                              },
                            ),
                        })
                      }
                    >
                      Đăng xuất
                    </Button>
                  ) : null}

                  {canManage ? (
                    <Button
                      variant="danger-soft"
                      onClick={() =>
                        setConfirm({
                          title: 'Gỡ khỏi tổ chức?',
                          body: `${row.email ?? row.userId} sẽ mất quyền truy cập ngay lập tức. Tài khoản của họ không bị xoá.`,
                          confirmLabel: 'Gỡ thành viên',
                          run: () =>
                            removeMember.mutate(row.userId, {
                              onSuccess: () => {
                                setConfirm(null);
                                toast.show({ tone: 'success', message: 'Đã gỡ thành viên' });
                              },
                              onError: fail,
                            }),
                        })
                      }
                    >
                      Gỡ
                    </Button>
                  ) : null}
                </RowActions>
              ),
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
          <Select name="role" label="Vai trò" required options={ROLE_OPTIONS} />
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
            người ở vai trò đó.
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
