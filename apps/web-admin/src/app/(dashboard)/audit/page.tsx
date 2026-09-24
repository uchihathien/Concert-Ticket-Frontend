'use client';

import {
  ApiError,
  useAuditLogs,
  useHasPermission,
  type AuditEntry,
  type OrganizationSummary,
} from '@nexaticket/ts-sdk';
import {
  AuditChange,
  Badge,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Select,
  Table,
  auditActionFilters,
  auditActionLabel,
  auditActionTone,
  formatDateTime,
} from '@nexaticket/ui';
import { useState } from 'react';
import { OrganizationGate } from '@/components/OrganizationGate';

/**
 * A-AUDIT — nhật ký kiểm toán của tổ chức.
 *
 * Bảng `audit_logs` được ghi từ ngày đầu nhưng chưa từng có màn hình nào đọc nó: mọi thao tác quản
 * trị đều để lại vết, và cách duy nhất để xem là mở database bằng tay. Một nhật ký không ai đọc
 * được thì không khác gì không có — nó chỉ tạo cảm giác đã kiểm soát.
 *
 * Trang này cố ý **chỉ đọc**: không sửa, không xoá, không có nút nào ngoài bộ lọc. Nhật ký mà sửa
 * được thì không còn là nhật ký.
 */
export default function AuditPage() {
  return (
    <OrganizationGate title="Nhật ký">
      {(organization) => <AuditContent organization={organization} />}
    </OrganizationGate>
  );
}

const FILTERS = auditActionFilters('organization');

const PAGE_SIZE = 50;

function AuditContent({ organization }: { organization: OrganizationSummary }) {
  const organizationId = organization.id;
  const canRead = useHasPermission('ORG_AUDIT_READ', organizationId);

  const [action, setAction] = useState('');
  const [offset, setOffset] = useState(0);

  // Không gọi API khi thiếu quyền: backend trả 403 và màn hình sẽ hiện một khối lỗi mà người dùng
  // không làm gì được. Nói thẳng "không có quyền" thì rõ hơn.
  const logs = useAuditLogs(canRead ? organizationId : null, {
    action: action || null,
    limit: PAGE_SIZE,
    offset,
  });

  if (!canRead) {
    return (
      <>
        <PageHeader title="Nhật ký" />
        <EmptyState
          title="Bạn không có quyền xem nhật ký"
          description="Nhật ký kiểm toán dành cho quản trị viên tổ chức trở lên."
        />
      </>
    );
  }

  const rows = logs.data ?? [];

  return (
    <>
      <PageHeader
        title="Nhật ký"
        description={`Vết của mọi thao tác quản trị trong ${organization.name}.`}
        actions={
          <div className="min-w-[220px]">
            <Select
              label="Lọc"
              value={action}
              options={FILTERS}
              onChange={(event) => {
                setAction(event.target.value);
                // Đổi bộ lọc thì phải quay về trang đầu: giữ nguyên offset sẽ cho ra một trang
                // trống ở giữa tập kết quả mới, và người dùng tưởng là không có dữ liệu.
                setOffset(0);
              }}
            />
          </div>
        }
      />

      {logs.isError ? (
        <ErrorState
          error={logs.error instanceof ApiError ? logs.error : null}
          correlationId={logs.error instanceof ApiError ? logs.error.correlationId : null}
          onRetry={() => void logs.refetch()}
        />
      ) : (
        <>
          <Table<AuditEntry>
            caption="Nhật ký kiểm toán"
            loading={logs.isPending}
            rows={rows}
            rowKey={(row) => row.id}
            emptyTitle="Chưa có thao tác nào được ghi"
            columns={[
              {
                key: 'time',
                header: 'Thời điểm',
                cell: (row) => formatDateTime(row.createdAt),
              },
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
            page={offset / PAGE_SIZE}
            received={rows.length}
            pageSize={PAGE_SIZE}
            onChange={(page) => setOffset(page * PAGE_SIZE)}
          />
        </>
      )}
    </>
  );
}
