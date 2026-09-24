'use client';

import {
  ApiError,
  ORGANIZATION_ROLES,
  useAuditLogs,
  useChangeMemberRole,
  useGrantMember,
  useHasPermission,
  useOrganization,
  useOrganizationLifecycle,
  useOrganizationMembers,
  usePendingInvitations,
  useRemoveMember,
  useRenameOrganization,
  useRevokeInvitation,
  useRevokeMemberSessions,
  useSendMemberPasswordReset,
  type AuditEntry,
  type Member,
  type OrganizationRole,
  type OrganizationSummary,
  type PendingInvitation,
} from '@nexaticket/ts-sdk';
import {
  AuditChange,
  Badge,
  Button,
  CopyField,
  DetailRows,
  ErrorState,
  FilterBar,
  Input,
  Modal,
  PageHeader,
  PageSkeleton,
  Pagination,
  Panel,
  RowActions,
  Section,
  Select,
  Table,
  auditActionFilters,
  auditActionLabel,
  auditActionTone,
  formatDate,
  formatDateTime,
  formatNumber,
  foldText,
  matchesText,
  roleLabel,
  roleTone,
  useToast,
} from '@nexaticket/ui';
import {
  ArrowLeft,
  KeyRound,
  Lock,
  LockOpen,
  LogOut,
  Pencil,
  Trash2,
  UserPlus,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';

/**
 * P-ORG — một tổ chức, nhìn từ phía nền tảng.
 *
 * Trước đây mọi thứ nền tảng làm được với một tổ chức đều nằm trong một dòng bảng: xem tên, và hết.
 * Khoá tổ chức, cấp thẳng một quản trị viên, đọc vết thao tác — cả ba đã có endpoint và có hook
 * trong SDK từ lâu, nhưng không màn nào gọi tới, nên cách duy nhất để dùng là curl.
 *
 * <h3>Vì sao superadmin đọc được dữ liệu của tổ chức mà không phải thành viên</h3>
 *
 * `TenantContext.requireMember` và `requirePermission` đều cho superadmin đi qua, đúng một chỗ ở
 * backend. Nên các hook `useOrganizationMembers` / `usePendingInvitations` / `useAuditLogs` ở đây là
 * cùng những hook mà `web-admin` dùng — không có đường đọc riêng cho nền tảng, và cũng không nên có
 * bản sao thứ hai của cùng một truy vấn.
 *
 * <h3>Bộ lọc của màn này nằm trong state, không trên URL</h3>
 *
 * Khác với danh sách tổ chức: ở đó bộ lọc là *cái nhìn* cần dán được vào ticket. Ở đây thứ cần chia
 * sẻ là chính tổ chức này, và nó đã nằm trong đường dẫn.
 */
export default function OrganizationDetailPage() {
  const params = useParams<{ organizationId: string }>();
  const organization = useOrganization(params.organizationId);

  if (organization.isError) {
    return (
      <>
        <BackLink />
        <PageHeader title="Tổ chức" />
        <ErrorState
          error={organization.error instanceof ApiError ? organization.error : null}
          correlationId={
            organization.error instanceof ApiError ? organization.error.correlationId : null
          }
          onRetry={() => void organization.refetch()}
        />
      </>
    );
  }

  if (!organization.data) {
    // Khung chờ này chỉ chạy khi điều hướng bằng client (bấm từ bảng sang): vào thẳng URL thì
    // `loading.tsx` của segment đã hiện trước rồi. Dùng cùng một component nên hai đường vào
    // không cho ra hai hình dạng chờ khác nhau.
    return (
      <>
        <BackLink />
        <PageSkeleton filters rows={6} />
      </>
    );
  }

  return <OrganizationDetail organization={organization.data} />;
}

function BackLink() {
  return (
    <p className="mb-3 mt-0">
      <Link
        href="/organizations"
        className="inline-flex items-center gap-1 text-[13px] text-muted no-underline hover:text-ink"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Mọi tổ chức
      </Link>
    </p>
  );
}

const ROLE_OPTIONS = ORGANIZATION_ROLES.map((role) => ({ value: role, label: roleLabel(role) }));

const ROLE_FILTERS = [{ value: '', label: 'Mọi vai trò' }, ...ROLE_OPTIONS];

const AUDIT_FILTERS = auditActionFilters('organization');

const AUDIT_PAGE_SIZE = 20;

interface ConfirmState {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  run: () => void;
}

function OrganizationDetail({ organization }: { organization: OrganizationSummary }) {
  const toast = useToast();
  const organizationId = organization.id;

  const canManage = useHasPermission('PLATFORM_ORG_MANAGE', null);

  const members = useOrganizationMembers(organizationId);
  const invitations = usePendingInvitations(organizationId);

  const [auditAction, setAuditAction] = useState('');
  const [auditPage, setAuditPage] = useState(0);
  const audit = useAuditLogs(organizationId, {
    action: auditAction || null,
    limit: AUDIT_PAGE_SIZE,
    offset: auditPage * AUDIT_PAGE_SIZE,
  });

  const rename = useRenameOrganization(organizationId);
  const lifecycle = useOrganizationLifecycle();
  const grantMember = useGrantMember(organizationId);
  const changeRole = useChangeMemberRole(organizationId);
  const removeMember = useRemoveMember(organizationId);
  const revokeSessions = useRevokeMemberSessions(organizationId);
  const sendPasswordReset = useSendMemberPasswordReset(organizationId);
  const revokeInvitation = useRevokeInvitation(organizationId);

  const [renaming, setRenaming] = useState(false);
  const [granting, setGranting] = useState(false);
  const [grantedToken, setGrantedToken] = useState<{ email: string; token: string } | null>(null);
  const [editing, setEditing] = useState<Member | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [lifecycleOpen, setLifecycleOpen] = useState(false);

  const [memberQuery, setMemberQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const fail = (error: unknown) => toast.showError(error instanceof ApiError ? error : null);
  const suspended = organization.status === 'SUSPENDED';

  // Phụ thuộc là `members.data`, không phải `members.data ?? []`: mảng rỗng mới ở mỗi render sẽ
  // làm memo chạy lại mỗi render.
  const memberData = members.data;
  const memberCount = memberData?.length ?? 0;

  const visibleMembers = useMemo(() => {
    const needle = foldText(memberQuery.trim());
    return (memberData ?? []).filter((row) => {
      if (roleFilter && row.role !== roleFilter) return false;
      return matchesText(needle, [row.fullName, row.email, row.userId]);
    });
  }, [memberData, memberQuery, roleFilter]);

  const memberFiltering = Boolean(memberQuery.trim() || roleFilter);
  const pendingInvitations = invitations.data ?? [];

  const submitRename = (formData: FormData) => {
    rename.mutate(String(formData.get('name') ?? '').trim(), {
      onSuccess: () => {
        setRenaming(false);
        toast.show({ tone: 'success', message: 'Đã đổi tên tổ chức' });
      },
      onError: fail,
    });
  };

  const submitGrant = (formData: FormData) => {
    grantMember.mutate(
      {
        email: String(formData.get('email') ?? '').trim(),
        role: String(formData.get('role') ?? 'ORG_ADMIN') as OrganizationRole,
      },
      {
        onSuccess: (result) => {
          setGranting(false);
          if (result.outcome === 'GRANTED') {
            toast.show({ tone: 'success', message: `Đã cấp quyền cho ${result.email}` });
            return;
          }
          // Người chưa từng đăng nhập thì chưa có danh tính để gắn membership vào, nên backend rơi
          // về lời mời. Token chỉ trả về đúng một lần — không hiện ra là mất.
          if (result.invitationToken) {
            setGrantedToken({ email: result.email, token: result.invitationToken });
          }
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

  const runLifecycle = () => {
    lifecycle.mutate(
      { organizationId, action: suspended ? 'activate' : 'suspend' },
      {
        onSuccess: () => {
          setLifecycleOpen(false);
          toast.show({
            tone: 'success',
            message: suspended ? 'Đã mở khoá tổ chức' : 'Đã khoá tổ chức',
          });
        },
        onError: fail,
      },
    );
  };

  return (
    <>
      <BackLink />

      <PageHeader
        title={organization.name}
        description={`Tổ chức ${organization.slug} — mọi thao tác ở đây đều để lại vết trong nhật ký.`}
        actions={
          canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setRenaming(true)}>
                <Pencil size={16} aria-hidden="true" />
                Đổi tên
              </Button>
              <Button onClick={() => setGranting(true)}>
                <UserPlus size={18} aria-hidden="true" />
                Cấp thành viên
              </Button>
              <Button
                variant={suspended ? 'secondary' : 'danger'}
                onClick={() => setLifecycleOpen(true)}
              >
                {suspended ? (
                  <LockOpen size={16} aria-hidden="true" />
                ) : (
                  <Lock size={16} aria-hidden="true" />
                )}
                {suspended ? 'Mở khoá' : 'Khoá tổ chức'}
              </Button>
            </div>
          ) : undefined
        }
      />

      <Panel>
        <DetailRows
          rows={[
            { label: 'Mã tổ chức', value: organization.id, mono: true },
            { label: 'Đường dẫn', value: organization.slug, mono: true },
            {
              label: 'Trạng thái',
              value: (
                <Badge tone={suspended ? 'warn' : 'success'}>
                  {suspended ? 'Đang khoá' : 'Đang hoạt động'}
                </Badge>
              ),
            },
            { label: 'Thành viên', value: formatNumber(organization.memberCount) },
            {
              label: 'Lời mời đang chờ',
              value: invitations.isPending
                ? '…'
                : formatNumber(pendingInvitations.filter((row) => !row.expired).length),
            },
          ]}
        />
      </Panel>

      <Section
        title="Thành viên"
        description="Người có quyền làm việc trong tổ chức này. Nền tảng cấp và gỡ được, và mọi lần đều vào nhật ký."
      >
        <FilterBar
          actions={
            <Button
              variant="secondary"
              disabled={!memberFiltering}
              onClick={() => {
                setMemberQuery('');
                setRoleFilter('');
              }}
            >
              Xoá bộ lọc
            </Button>
          }
          count={
            members.isPending
              ? 'Đang tải…'
              : memberFiltering
                ? `Hiện ${formatNumber(visibleMembers.length)} trong ${formatNumber(memberCount)} thành viên.`
                : `${formatNumber(memberCount)} thành viên.`
          }
        >
          <Input
            label="Tìm thành viên"
            type="search"
            value={memberQuery}
            placeholder="Tên, email hoặc mã người dùng"
            onChange={(event) => setMemberQuery(event.target.value)}
          />
          <Select
            label="Vai trò"
            value={roleFilter}
            options={ROLE_FILTERS}
            onChange={(event) => setRoleFilter(event.target.value)}
          />
        </FilterBar>

        {members.isError ? (
          <div className="mt-5">
            <ErrorState
              error={members.error instanceof ApiError ? members.error : null}
              correlationId={members.error instanceof ApiError ? members.error.correlationId : null}
              onRetry={() => void members.refetch()}
            />
          </div>
        ) : (
          <div className="mt-5">
            <Table<Member>
              caption="Thành viên của tổ chức"
              loading={members.isPending}
              rows={visibleMembers}
              rowKey={(row) => row.userId}
              emptyTitle={
                memberFiltering ? 'Không thành viên nào khớp bộ lọc' : 'Chưa có thành viên nào'
              }
              emptyDescription={
                memberFiltering
                  ? undefined
                  : 'Chủ sở hữu chưa nhận lời mời. Cấp thẳng một người để tổ chức bắt đầu làm việc được.'
              }
              columns={[
                {
                  key: 'user',
                  header: 'Người dùng',
                  // Email là thứ nhận ra được người; id chỉ có nghĩa khi đi báo lỗi.
                  cell: (row) => (
                    <div className="grid gap-0.5">
                      <span className="font-medium">{row.fullName ?? row.email ?? row.userId}</span>
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
                  cell: (row) =>
                    canManage ? (
                      <RowActions>
                        <Button variant="ghost" onClick={() => setEditing(row)}>
                          <Pencil size={16} aria-hidden="true" />
                          Đổi vai trò
                        </Button>
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
                          <LogOut size={16} aria-hidden="true" />
                          Đăng xuất
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
                          <KeyRound size={16} aria-hidden="true" />
                          Đặt lại mật khẩu
                        </Button>
                        <Button
                          variant="danger-soft"
                          onClick={() =>
                            setConfirm({
                              title: 'Gỡ khỏi tổ chức?',
                              body: `${row.email ?? row.userId} sẽ mất quyền truy cập ngay lập tức. Tài khoản của họ không bị xoá.`,
                              confirmLabel: 'Gỡ thành viên',
                              danger: true,
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
                          <Trash2 size={16} aria-hidden="true" />
                          Gỡ
                        </Button>
                      </RowActions>
                    ) : null,
                },
              ]}
            />
          </div>
        )}
      </Section>

      {pendingInvitations.length > 0 ? (
        <Section
          title="Lời mời đang chờ"
          description="Người đã được mời nhưng chưa nhận. Thu hồi thì mã cũ hết hiệu lực ngay."
        >
          <Table<PendingInvitation>
            caption="Lời mời đang chờ"
            loading={invitations.isPending}
            rows={pendingInvitations}
            rowKey={(row) => row.id}
            emptyTitle="Không có lời mời nào đang chờ"
            columns={[
              { key: 'email', header: 'Email', cell: (row) => row.email },
              { key: 'role', header: 'Vai trò', cell: (row) => roleLabel(row.role) },
              {
                key: 'expires',
                header: 'Hết hạn',
                cell: (row) =>
                  row.expired ? (
                    <Badge tone="danger">Đã hết hạn</Badge>
                  ) : (
                    formatDateTime(row.expiresAt)
                  ),
              },
              {
                key: 'actions',
                header: '',
                cell: (row) =>
                  canManage ? (
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
                        <Trash2 size={16} aria-hidden="true" />
                        Thu hồi
                      </Button>
                    </RowActions>
                  ) : null,
              },
            ]}
          />
        </Section>
      ) : null}

      <Section
        title="Nhật ký"
        description="Vết của mọi thao tác quản trị trong tổ chức này, kể cả những thao tác do nền tảng làm."
        actions={
          <div className="min-w-[220px]">
            <Select
              label="Lọc hành động"
              value={auditAction}
              options={AUDIT_FILTERS}
              onChange={(event) => {
                setAuditAction(event.target.value);
                // Đổi bộ lọc thì phải quay về trang đầu: giữ nguyên offset sẽ cho ra một trang
                // trống ở giữa tập kết quả mới, và người dùng tưởng là không có dữ liệu.
                setAuditPage(0);
              }}
            />
          </div>
        }
      >
        {audit.isError ? (
          <ErrorState
            error={audit.error instanceof ApiError ? audit.error : null}
            correlationId={audit.error instanceof ApiError ? audit.error.correlationId : null}
            onRetry={() => void audit.refetch()}
          />
        ) : (
          <>
            <Table<AuditEntry>
              caption="Nhật ký kiểm toán của tổ chức"
              loading={audit.isPending}
              rows={audit.data ?? []}
              rowKey={(row) => row.id}
              emptyTitle="Chưa có thao tác nào được ghi"
              columns={[
                { key: 'time', header: 'Thời điểm', cell: (row) => formatDateTime(row.createdAt) },
                {
                  key: 'action',
                  header: 'Hành động',
                  cell: (row) => (
                    <Badge tone={auditActionTone(row.action)}>{auditActionLabel(row.action)}</Badge>
                  ),
                },
                {
                  key: 'entity',
                  header: 'Đối tượng',
                  cell: (row) => (
                    <span className="text-[13px] text-muted">
                      {row.entityType}
                      {row.entityId ? ` · ${row.entityId.slice(0, 8)}` : ''}
                    </span>
                  ),
                },
                {
                  key: 'change',
                  header: 'Thay đổi',
                  cell: (row) => <AuditChange before={row.beforeState} after={row.afterState} />,
                },
              ]}
            />
            <Pagination
              page={auditPage}
              received={(audit.data ?? []).length}
              pageSize={AUDIT_PAGE_SIZE}
              onChange={setAuditPage}
            />
          </>
        )}
      </Section>

      <Modal
        open={renaming}
        onClose={() => setRenaming(false)}
        title="Đổi tên tổ chức"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenaming(false)}>
              Huỷ
            </Button>
            <Button type="submit" form="rename-organization" loading={rename.isPending}>
              Lưu
            </Button>
          </>
        }
      >
        <form id="rename-organization" action={submitRename} className="grid gap-4">
          <Input
            name="name"
            label="Tên tổ chức"
            required
            maxLength={200}
            defaultValue={organization.name}
          />
          <p className="m-0 text-[13px] text-muted">
            Đường dẫn <code className="font-mono">{organization.slug}</code> không đổi theo: nó đã
            nằm trong liên kết công khai của các sự kiện và trong đường dẫn khách đã lưu.
          </p>
        </form>
      </Modal>

      <Modal
        open={granting}
        onClose={() => setGranting(false)}
        title="Cấp thành viên"
        footer={
          <>
            <Button variant="secondary" onClick={() => setGranting(false)}>
              Huỷ
            </Button>
            <Button type="submit" form="grant-member" loading={grantMember.isPending}>
              Cấp quyền
            </Button>
          </>
        }
      >
        <form id="grant-member" action={submitGrant} className="grid gap-4">
          <Input name="email" type="email" label="Email" required />
          <Select
            name="role"
            label="Vai trò"
            required
            defaultValue="ORG_ADMIN"
            options={ROLE_OPTIONS}
          />
          <p className="m-0 text-[13px] text-muted">
            Người đã từng đăng nhập sẽ có quyền ngay. Người chưa từng thì hệ thống rơi về lời mời và
            trả về một mã dùng một lần — vì chưa có danh tính nào để gắn quyền vào.
          </p>
        </form>
      </Modal>

      <Modal
        open={grantedToken !== null}
        onClose={() => setGrantedToken(null)}
        title="Đã tạo lời mời"
        footer={<Button onClick={() => setGrantedToken(null)}>Xong</Button>}
      >
        <p className="mt-0">
          <strong>{grantedToken?.email}</strong> chưa từng đăng nhập nên chưa gắn quyền được ngay.
          Gửi mã dưới đây cho họ.
        </p>
        {grantedToken ? <CopyField label="Mã lời mời" value={grantedToken.token} /> : null}
        <p className="mb-0 text-[13px] text-muted">Mã chỉ hiện đúng một lần.</p>
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
            Tổ chức luôn phải còn ít nhất một chủ sở hữu — backend từ chối nếu thao tác này lấy đi
            người cuối cùng.
          </p>
        </form>
      </Modal>

      <Modal
        open={lifecycleOpen}
        onClose={() => setLifecycleOpen(false)}
        title={suspended ? 'Mở khoá tổ chức?' : 'Khoá tổ chức?'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setLifecycleOpen(false)}>
              Huỷ
            </Button>
            <Button
              variant={suspended ? 'primary' : 'danger'}
              onClick={runLifecycle}
              loading={lifecycle.isPending}
            >
              {suspended ? 'Mở khoá' : 'Khoá tổ chức'}
            </Button>
          </>
        }
      >
        {suspended ? (
          <p className="m-0">
            <strong>{organization.name}</strong> hoạt động lại bình thường ngay sau khi mở khoá.
          </p>
        ) : (
          <p className="m-0">
            <strong>{organization.name}</strong> sẽ không mời được thành viên mới. Khoá{' '}
            <strong>không</strong> dừng việc bán vé đang diễn ra và không xoá gì — muốn dừng bán thì
            phải rút sự kiện xuống ở phía tổ chức.
          </p>
        )}
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
              variant={confirm?.danger ? 'danger' : 'primary'}
              onClick={() => confirm?.run()}
              loading={
                removeMember.isPending || revokeSessions.isPending || sendPasswordReset.isPending
              }
            >
              {confirm?.confirmLabel ?? 'Đồng ý'}
            </Button>
          </>
        }
      >
        <p className="m-0">{confirm?.body}</p>
      </Modal>
    </>
  );
}
