export interface AuditChangeProps {
  /** `beforeState` của một dòng nhật ký. JSON đã parse, hình dạng khác nhau theo từng hành động. */
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

/**
 * Ô "đã đổi gì" của một dòng nhật ký kiểm toán.
 *
 * Trước → sau, không phải một khối JSON dán nguyên: đó là câu hỏi người mở nhật ký thật sự có.
 * Hình dạng payload khác nhau theo từng hành động — backend cố ý không ép chúng vào một kiểu chung
 * — nên ở đây chỉ phẳng hoá thành `khoá: giá trị` rồi ghép hai đầu khi có cả hai.
 *
 * Là component dùng chung vì hai màn đọc cùng bảng `audit_logs`: A-AUDIT của tổ chức và P-ORG của
 * nền tảng. Chép sang màn thứ hai thì hai nơi phẳng hoá theo hai luật, và cùng một dòng nhật ký
 * đọc ra hai nghĩa.
 */
export function AuditChange({ before, after }: AuditChangeProps) {
  const from = flatten(before);
  const to = flatten(after);

  if (!from && !to) {
    return <span style={{ color: 'var(--nt-text-muted)' }}>—</span>;
  }
  if (from && to) {
    return (
      <span style={{ fontSize: 13 }}>
        <span style={{ color: 'var(--nt-text-muted)' }}>{from}</span>
        {' → '}
        <span>{to}</span>
      </span>
    );
  }
  return <span style={{ fontSize: 13 }}>{to ?? from}</span>;
}

function flatten(state: Record<string, unknown> | null | undefined): string | null {
  if (!state) return null;
  const parts = Object.entries(state)
    .filter(([, value]) => value !== null && value !== '')
    .map(([key, value]) => `${key}: ${String(value)}`);
  return parts.length === 0 ? null : parts.join(', ');
}
