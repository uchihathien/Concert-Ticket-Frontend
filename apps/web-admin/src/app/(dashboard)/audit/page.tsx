'use client';

import {
  ApiError,
  useAuditLogs,
  useHasPermission,
  type AuditEntry,
  type OrganizationSummary,
} from '@nexaticket/ts-sdk';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  Select,
  Table,
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

/**
 * Nhãn tiếng Việt cho từng hành động.
 *
 * Hành động lạ thì hiện nguyên mã: thà một dòng khó đọc còn hơn một dòng biến mất. Danh sách này
 * đi sau backend một nhịp là chuyện bình thường — backend thêm hành động mới trước, ở đây bổ sung
 * sau, và trong khoảng giữa thì mã thô vẫn nói đủ.
 */
const ACTION_LABELS: Record<string, string> = {
  ORGANIZATION_CREATED: 'Tạo tổ chức',
  ORGANIZATION_RENAMED: 'Đổi tên tổ chức',
  ORGANIZATION_SUSPENDED: 'Khoá tổ chức',
  ORGANIZATION_ACTIVATED: 'Mở khoá tổ chức',
  MEMBER_INVITED: 'Mời thành viên',
  MEMBER_JOINED: 'Thành viên tham gia',
  MEMBER_GRANTED: 'Cấp quyền thành viên',
  MEMBER_ROLE_CHANGED: 'Đổi vai trò',
  MEMBER_REMOVED: 'Gỡ thành viên',
  INVITATION_REVOKED: 'Thu hồi lời mời',
  SESSIONS_REVOKED: 'Thu hồi mọi phiên',
  SESSION_REVOKED: 'Thu hồi một phiên',
  PASSWORD_RESET_SENT: 'Gửi thư đặt lại mật khẩu',
  PURCHASE_LIMITS_CHANGED: 'Đổi trần mua vé',
  USER_DISABLED: 'Vô hiệu hoá tài khoản',
  USER_ENABLED: 'Khôi phục tài khoản',
};

/** Chỉ những hành động thuộc phạm vi tổ chức mới có nghĩa trong bộ lọc của màn này. */
const FILTERS = [
  { value: '', label: 'Tất cả hành động' },
  ...Object.keys(ACTION_LABELS)
    .filter((action) => !action.startsWith('USER_'))
    .map((action) => ({ value: action, label: ACTION_LABELS[action] as string })),
];

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
          <div style={{ minWidth: 220 }}>
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
                  <Badge tone={toneOf(row.action)}>{ACTION_LABELS[row.action] ?? row.action}</Badge>
                ),
              },
              {
                key: 'entity',
                header: 'Đối tượng',
                cell: (row) => (
                  <span style={{ color: 'var(--nt-text-muted)', fontSize: 13 }}>
                    {row.entityType}
                    {row.entityId ? ` · ${row.entityId.slice(0, 8)}` : ''}
                  </span>
                ),
              },
              {
                key: 'change',
                header: 'Thay đổi',
                // Trước → sau, không phải một khối JSON dán nguyên. Đây là câu hỏi người đọc nhật
                // ký thật sự có: cái gì đã đổi thành cái gì.
                cell: (row) => <Change entry={row} />,
              },
            ]}
          />

          <nav
            style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}
            aria-label="Phân trang nhật ký"
          >
            <Button
              variant="secondary"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              Trang trước
            </Button>
            <Button
              variant="secondary"
              // Backend không trả tổng số dòng. Trang đầy nghĩa là "có thể còn nữa" — đó là tất cả
              // những gì suy ra được, và đoán thêm sẽ hiện một nút dẫn tới trang trống.
              disabled={rows.length < PAGE_SIZE}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Trang sau
            </Button>
          </nav>
        </>
      )}
    </>
  );
}

/** Hành động phá huỷ nổi bật hơn: đó là những dòng người ta mở nhật ký ra để tìm. */
function toneOf(action: string) {
  if (action.includes('REMOVED') || action.includes('REVOKED') || action.includes('DISABLED')) {
    return 'danger' as const;
  }
  if (action.includes('CREATED') || action.includes('JOINED') || action.includes('GRANTED')) {
    return 'success' as const;
  }
  return 'neutral' as const;
}

/**
 * Phần "đã đổi gì".
 *
 * Hình dạng payload khác nhau theo từng hành động — backend cố ý không ép chúng vào một kiểu chung
 * — nên ở đây chỉ phẳng hoá thành `khoá: giá trị` và ghép trước → sau khi có cả hai.
 */
function Change({ entry }: { entry: AuditEntry }) {
  const before = flatten(entry.beforeState);
  const after = flatten(entry.afterState);

  if (!before && !after) {
    return <span style={{ color: 'var(--nt-text-muted)' }}>—</span>;
  }
  if (before && after) {
    return (
      <span style={{ fontSize: 13 }}>
        <span style={{ color: 'var(--nt-text-muted)' }}>{before}</span>
        {' → '}
        <span>{after}</span>
      </span>
    );
  }
  return <span style={{ fontSize: 13 }}>{after ?? before}</span>;
}

function flatten(state: Record<string, unknown> | null): string | null {
  if (!state) return null;
  const parts = Object.entries(state)
    .filter(([, value]) => value !== null && value !== '')
    .map(([key, value]) => `${key}: ${String(value)}`);
  return parts.length === 0 ? null : parts.join(', ');
}
