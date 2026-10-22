'use client';

import { useAuditLogs, useHasPermission, useOrganizationMembers, type AuditEntry, type StaffMember } from '@nexaticket/ts-sdk';
import { Badge, Section, Table, auditActionLabel, formatDateTime } from '@nexaticket/ui';
import Link from 'next/link';
import { useMemo } from 'react';

const MAX_ROWS = 30;

/**
 * Lịch sử mời, gửi lại, huỷ và đổi sự kiện của nhân viên soát vé.
 *
 * Đọc từ chính nhật ký của tổ chức (những dòng `STAFF_*` mà backend đã ghi sẵn), không có nguồn
 * riêng — nên nó không bao giờ nói khác trang Nhật ký. Mỗi hành động là một lượt hỏi có lọc ở
 * SERVER: nhật ký phân trang ở backend, lọc ở trình duyệt sẽ chỉ lọc trong trang đầu.
 *
 * Cần quyền xem nhật ký (`ORG_AUDIT_READ`); thiếu quyền thì khối này không hiện, thay vì hiện một
 * lỗi 403 mà người xem không làm gì được.
 */
export function StaffHistory({ organizationId, staff }: { organizationId: string; staff: StaffMember[] }) {
  const canRead = useHasPermission('ORG_AUDIT_READ', organizationId);
  const scope = canRead ? organizationId : null;
  const invited = useAuditLogs(scope, { action: 'STAFF_INVITED' });
  const resent = useAuditLogs(scope, { action: 'STAFF_INVITATION_RESENT' });
  const cancelled = useAuditLogs(scope, { action: 'STAFF_INVITATION_CANCELLED' });
  const reassigned = useAuditLogs(scope, { action: 'STAFF_EVENTS_CHANGED' });
  const created = useAuditLogs(scope, { action: 'STAFF_ACCOUNT_CREATED' });
  const pinReset = useAuditLogs(scope, { action: 'STAFF_PIN_RESET' });
  const locked = useAuditLogs(scope, { action: 'STAFF_ACCOUNT_LOCKED' });
  const expired = useAuditLogs(scope, { action: 'STAFF_ACCOUNT_EXPIRED' });
  const members = useOrganizationMembers(scope);

  const rows = useMemo(
    () =>
      [invited, resent, cancelled, reassigned, created, pinReset, locked, expired]
        .flatMap((query) => query.data ?? [])
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, MAX_ROWS),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- đủ khi dữ liệu từng truy vấn đổi
    [invited.data, resent.data, cancelled.data, reassigned.data, created.data, pinReset.data, locked.data, expired.data],
  );

  const staffName = useMemo(() => new Map(staff.map((item) => [item.userId, item.fullName ?? item.username ?? item.email])), [staff]);
  const memberName = useMemo(
    () => new Map((members.data ?? []).map((item) => [item.userId, item.fullName ?? item.email ?? item.userId.slice(0, 8)])),
    [members.data],
  );

  if (!canRead) return null;

  return (
    <Section
      title="Lịch sử mời và phân công"
      description={`${MAX_ROWS} thao tác gần nhất với nhân viên soát vé.`}
      actions={
        <Link href="/audit" className="text-[13px] font-semibold text-primary-text">
          Xem toàn bộ nhật ký →
        </Link>
      }
    >
      <Table<AuditEntry>
        caption="Lịch sử mời và phân công nhân viên soát vé"
        rows={rows}
        rowKey={(row) => row.id}
        loading={invited.isPending || resent.isPending || cancelled.isPending || reassigned.isPending}
        emptyTitle="Chưa có thao tác nào"
        emptyDescription="Lời mời, gửi lại, huỷ và đổi sự kiện sẽ xuất hiện ở đây."
        columns={[
          { key: 'at', header: 'Thời điểm', cell: (row) => formatDateTime(row.createdAt) },
          {
            key: 'action',
            header: 'Thao tác',
            cell: (row) => <Badge tone={row.action === 'STAFF_INVITATION_CANCELLED' ? 'danger' : 'neutral'}>{auditActionLabel(row.action)}</Badge>,
          },
          {
            key: 'staff',
            header: 'Nhân viên',
            // Nhân viên đã bị huỷ lời mời không còn trong bảng phía trên; khi đó lấy email ghi trong
            // chính dòng nhật ký, và chỉ khi cả hai đều không có mới hiện dấu gạch.
            cell: (row) => (row.entityId ? staffName.get(row.entityId) : undefined) ?? detailText(row, 'email') ?? '—',
          },
          { key: 'detail', header: 'Chi tiết', cell: (row) => describe(row) },
          {
            key: 'actor',
            header: 'Người thực hiện',
            cell: (row) => (row.actorUserId ? (memberName.get(row.actorUserId) ?? `Người dùng ${row.actorUserId.slice(0, 8)}`) : 'Hệ thống'),
          },
        ]}
      />
    </Section>
  );
}

function detailText(row: AuditEntry, key: string): string | undefined {
  const value = row.afterState?.[key] ?? row.beforeState?.[key];
  return typeof value === 'string' && value ? value : undefined;
}

function describe(row: AuditEntry): string {
  const events = row.afterState?.['eventIds'] ?? row.afterState?.['events'];
  if (Array.isArray(events)) return `${events.length} sự kiện được gán`;
  if (typeof events === 'number') return `${events} sự kiện được gán`;
  return '—';
}
