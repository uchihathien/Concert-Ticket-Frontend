'use client';

import {
  Badge,
  Button,
  CopyField,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  Table,
  formatDate,
  useToast,
} from '@nexaticket/ui';
import {
  ApiError,
  useCreateOrganization,
  usePlatformOrganizations,
  type CreatedOrganization,
  type OrganizationSummary,
} from '@nexaticket/ts-sdk';
import { useState } from 'react';

/**
 * P-ORGS — danh sách tổ chức toàn nền tảng và luồng tạo mới.
 *
 * Chỉ superadmin gọi được `/v1/platform/organizations`; backend tự kiểm, frontend không đoán vai
 * trò. Người không đủ quyền sẽ thấy đúng lỗi từ server thay vì một màn trắng.
 *
 * ADR-1010: không có luồng tự đăng ký tổ chức. Tạo ở đây là đường duy nhất.
 */
export default function OrganizationsPage() {
  const toast = useToast();
  const organizations = usePlatformOrganizations({ limit: 200 });
  const createOrganization = useCreateOrganization();

  const [formOpen, setFormOpen] = useState(false);
  const [created, setCreated] = useState<CreatedOrganization | null>(null);

  const submit = (formData: FormData) => {
    const name = String(formData.get('name') ?? '').trim();
    const ownerEmail = String(formData.get('ownerEmail') ?? '').trim();
    const slug = String(formData.get('slug') ?? '').trim();

    createOrganization.mutate(
      { name, ownerEmail, ...(slug ? { slug } : {}) },
      {
        onSuccess: (organization) => {
          setFormOpen(false);
          // Token lời mời chỉ trả về ĐÚNG MỘT LẦN. Đóng hộp thoại mà không hiện nó ra là mất
          // luôn — chủ sở hữu mới sẽ không vào được tổ chức vừa tạo.
          setCreated(organization);
        },
        onError: (error) => toast.showError(error instanceof ApiError ? error : null),
      },
    );
  };

  return (
    <>
      <PageHeader
        title="Tổ chức"
        description="Mọi tổ chức trên nền tảng. Tạo tổ chức là đường duy nhất để một đơn vị bắt đầu bán vé."
        actions={<Button onClick={() => setFormOpen(true)}>Tạo tổ chức</Button>}
      />

      {organizations.isError ? (
        <ErrorState
          error={organizations.error instanceof ApiError ? organizations.error : null}
          correlationId={
            organizations.error instanceof ApiError ? organizations.error.correlationId : null
          }
          onRetry={() => void organizations.refetch()}
        />
      ) : (
        <Table<OrganizationSummary>
          caption="Danh sách tổ chức"
          loading={organizations.isPending}
          rows={organizations.data ?? []}
          rowKey={(row) => row.id}
          emptyTitle="Chưa có tổ chức nào"
          emptyDescription="Tạo tổ chức đầu tiên để bắt đầu."
          columns={[
            { key: 'name', header: 'Tên', cell: (row) => row.name },
            { key: 'slug', header: 'Đường dẫn', cell: (row) => row.slug },
            {
              key: 'status',
              header: 'Trạng thái',
              cell: (row) => (
                <Badge tone={row.status === 'ACTIVE' ? 'success' : 'warn'}>
                  {row.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đang khoá'}
                </Badge>
              ),
            },
            {
              key: 'members',
              header: 'Thành viên',
              numeric: true,
              cell: (row) => row.memberCount,
            },
          ]}
        />
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Tạo tổ chức"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Huỷ
            </Button>
            <Button type="submit" form="create-organization" loading={createOrganization.isPending}>
              Tạo
            </Button>
          </>
        }
      >
        <form id="create-organization" action={submit} style={{ display: 'grid', gap: 16 }}>
          <Input name="name" label="Tên tổ chức" required maxLength={200} />
          <Input
            name="ownerEmail"
            type="email"
            label="Email chủ sở hữu"
            required
            hint="Người này nhận lời mời làm ORG_OWNER."
          />
          <Input
            name="slug"
            label="Đường dẫn"
            maxLength={64}
            hint="Bỏ trống thì hệ thống tự sinh từ tên."
          />
        </form>
      </Modal>

      <Modal
        open={created !== null}
        onClose={() => setCreated(null)}
        title="Đã tạo tổ chức"
        footer={<Button onClick={() => setCreated(null)}>Xong</Button>}
      >
        <p style={{ marginTop: 0 }}>
          <strong>{created?.name}</strong> đã được tạo ngày {formatDate(new Date())}. Gửi mã lời mời
          dưới đây cho <strong>{created?.ownerEmail}</strong> để họ nhận quyền chủ sở hữu.
        </p>
        {created ? <CopyField label="Mã lời mời" value={created.invitationToken} /> : null}
        <p style={{ marginBottom: 0, color: 'var(--nt-text-muted)', fontSize: 13 }}>
          Mã này chỉ hiện đúng một lần. Đóng hộp thoại là không đọc lại được.
        </p>
      </Modal>
    </>
  );
}
