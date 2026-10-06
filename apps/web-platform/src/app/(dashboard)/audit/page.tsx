'use client';

import {
  ApiError,
  useHasPermission,
  usePlatformAuditLogs,
  type AuditEntry,
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
  vnDayRange,
} from '@nexaticket/ui';
import Link from 'next/link';
import { useMemo, useState } from 'react';

/**
 * P-AUDIT — nhật ký kiểm toán của toàn nền tảng (`GET /v1/platform/audit-logs`).
 *
 * Hook `usePlatformAuditLogs` có trong SDK từ lâu nhưng không màn nào gọi: nhật ký từng tổ chức
 * đã đọc được ở trang chi tiết tổ chức, còn thao tác của chính nền tảng (khoá tài khoản, cấp quyền
 * thẳng, tạo tổ chức) thì chỉ xem được bằng curl.
 *
 * Giống nhật ký tổ chức, trang này **chỉ đọc** và lọc ở server.
 */
const FILTERS = auditActionFilters('platform');

const PAGE_SIZE = 50;

const RANGE_FILTERS = [
  { value: '', label: 'Mọi lúc' },
  { value: 'today', label: 'Hôm nay' },
  { value: '7d', label: '7 ngày qua' },
  { value: '30d', label: '30 ngày qua' },
];

export default function PlatformAuditPage() {
  // `SuperAdminGate` đã chờ `useMyPermissions` tải xong, nên ở đây `false` nghĩa là thật sự thiếu
  // quyền chứ không phải "chưa biết". Thiếu quyền thì không gọi API: backend sẽ trả 403 và người
  // dùng chỉ thấy một khối lỗi họ không làm gì được.
  const canRead = useHasPermission('PLATFORM_AUDIT_READ', null);

  if (!canRead) {
    return (
      <>
        <PageHeader title="Nhật ký nền tảng" />
        <EmptyState
          title="Bạn không có quyền xem nhật ký nền tảng"
          description="Nhật ký nền tảng cần quyền PLATFORM_AUDIT_READ."
        />
      </>
    );
  }

  return <PlatformAuditContent />;
}

function PlatformAuditContent() {
  const [action, setAction] = useState('');
  const [range, setRange] = useState('');
  const [offset, setOffset] = useState(0);

  // Nửa đêm tính theo giờ VIỆT NAM, không theo máy người dùng — xem `vnDayRange`.
  const period = useMemo(() => {
    if (!range) return null;
    return vnDayRange(range === 'today' ? 0 : range === '7d' ? 6 : 29);
  }, [range]);

  const logs = usePlatformAuditLogs({
    action: action || null,
    from: period?.from ?? null,
    to: period?.to ?? null,
    limit: PAGE_SIZE,
    offset,
  });

  const rows = logs.data ?? [];

  return (
    <>
      <PageHeader
        title="Nhật ký nền tảng"
        description="Vết của mọi thao tác quản trị trên toàn nền tảng, mới nhất trước."
        actions={
          <div className="flex flex-wrap gap-3">
            <div className="min-w-[200px]">
              <Select
                label="Hành động"
                value={action}
                options={FILTERS}
                onChange={(event) => {
                  setAction(event.target.value);
                  // Đổi bộ lọc thì quay về trang đầu, nếu không sẽ ra một trang trống giữa tập mới.
                  setOffset(0);
                }}
              />
            </div>
            <div className="min-w-[200px]">
              <Select
                label="Thời gian"
                value={range}
                options={RANGE_FILTERS}
                onChange={(event) => {
                  setRange(event.target.value);
                  setOffset(0);
                }}
              />
            </div>
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
            caption="Nhật ký kiểm toán nền tảng"
            loading={logs.isPending}
            rows={rows}
            rowKey={(row) => row.id}
            emptyTitle={
              action || range
                ? 'Không có thao tác nào khớp bộ lọc'
                : 'Chưa có thao tác nào được ghi'
            }
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
                key: 'organization',
                header: 'Tổ chức',
                cell: (row) =>
                  row.organizationId ? (
                    <Link
                      href={`/organizations/${row.organizationId}`}
                      className="font-mono text-[13px]"
                      title={row.organizationId}
                    >
                      {row.organizationId.slice(0, 8)}
                    </Link>
                  ) : (
                    <span className="text-[13px] text-muted">Nền tảng</span>
                  ),
              },
              {
                key: 'actor',
                header: 'Người thực hiện',
                cell: (row) => (
                  <span className="font-mono text-[13px] text-muted" title={row.actorUserId ?? ''}>
                    {row.actorUserId ? row.actorUserId.slice(0, 8) : 'Hệ thống'}
                  </span>
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
