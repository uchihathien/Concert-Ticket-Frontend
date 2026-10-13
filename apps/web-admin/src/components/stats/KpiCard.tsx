import { Panel, Skeleton } from '@nexaticket/ui';
import { ArrowDownRight, ArrowUpRight, CircleHelp, Minus } from 'lucide-react';
import type { ReactNode } from 'react';
import { fillTone, formatPercent, type Delta } from '@/lib/stats-math';

/**
 * Một thẻ chỉ số.
 *
 * <h3>Ba trạng thái không được trông giống nhau</h3>
 *
 * `loading` vẽ khung xương; `value === null` vẽ "—" (không tính được, hoặc chưa có dữ liệu); một con
 * số thật thì vẽ con số. Hiện "0" cho hai trường hợp đầu là nói sai với ban tổ chức về chính việc
 * kinh doanh của họ.
 *
 * <h3>Mỗi thẻ mang định nghĩa của chính nó</h3>
 *
 * `help` là định nghĩa DUY NHẤT của chỉ số, hiện khi trỏ hoặc focus vào dấu hỏi. Hai trang cùng hiện
 * "Doanh thu" phải dùng cùng một câu ở đây — xem `METRIC_HELP`.
 */
export interface KpiCardProps {
  label: string;
  value: ReactNode | null;
  loading?: boolean;
  help?: string;
  hint?: ReactNode;
  delta?: Delta | null;
  /** Nhãn kỳ so sánh, ví dụ "so với 7 ngày trước". */
  deltaLabel?: string;
  /** 0..1; vẽ thanh tiến độ tô màu theo ngưỡng lấp đầy. */
  progress?: number | null;
  icon?: ReactNode;
}

export function KpiCard({ label, value, loading, help, hint, delta, deltaLabel, progress, icon }: KpiCardProps) {
  return (
    <Panel className="flex min-w-0 flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <p className="m-0 flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-muted">
          <span className="truncate">{label}</span>
          {help ? <HelpTip text={help} label={label} /> : null}
        </p>
        {icon ? (
          <span
            aria-hidden="true"
            className="grid size-8 flex-none place-items-center rounded-nt bg-accent text-primary-text [&_svg]:size-4"
          >
            {icon}
          </span>
        ) : null}
      </div>

      {loading ? (
        <Skeleton width="55%" height={28} />
      ) : (
        <p className="m-0 text-[24px] leading-tight font-bold tracking-tight tabular-nums break-words">
          {value ?? <span className="text-muted">—</span>}
        </p>
      )}

      {progress !== undefined && !loading ? <ProgressBar value={progress} /> : null}

      {!loading && (delta || hint) ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-muted">
          {delta ? <DeltaBadge delta={delta} label={deltaLabel} /> : null}
          {hint ? <span>{hint}</span> : null}
        </div>
      ) : null}
    </Panel>
  );
}

function DeltaBadge({ delta, label }: { delta: Delta; label?: string }) {
  const tone =
    delta.direction === 'up' ? 'text-success-text' : delta.direction === 'down' ? 'text-danger-text' : 'text-muted';
  const text = delta.fromZero
    ? 'mới'
    : delta.percent === null
      ? 'không đổi'
      : `${delta.percent > 0 ? '+' : ''}${formatPercent(delta.percent, 1)}`;
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold tabular-nums ${tone}`}>
      {delta.direction === 'up' ? (
        <ArrowUpRight size={14} aria-hidden="true" />
      ) : delta.direction === 'down' ? (
        <ArrowDownRight size={14} aria-hidden="true" />
      ) : (
        <Minus size={14} aria-hidden="true" />
      )}
      {/* Mũi tên chỉ là hình; chiều tăng giảm phải đọc được bằng chữ cho trình đọc màn hình. */}
      <span className="sr-only">
        {delta.direction === 'up' ? 'Tăng' : delta.direction === 'down' ? 'Giảm' : 'Không đổi'}
      </span>
      {text}
      {label ? <span className="font-normal text-muted">&nbsp;{label}</span> : null}
    </span>
  );
}

const TONE_BG = {
  danger: 'bg-danger',
  warn: 'bg-warn',
  success: 'bg-success',
  none: 'bg-border',
} as const;

export function ProgressBar({ value, label }: { value: number | null; label?: string }) {
  const percent = value === null ? 0 : Math.min(100, Math.max(0, value * 100));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value === null ? undefined : Math.round(percent)}
      className="h-2 w-full overflow-hidden rounded-full bg-bg-subtle"
    >
      <div className={`h-full rounded-full ${TONE_BG[fillTone(value)]}`} style={{ width: `${percent}%` }} />
    </div>
  );
}

/**
 * Dấu hỏi mang định nghĩa của chỉ số.
 *
 * Là một `<button>` thật để bàn phím tới được, và chú giải hiện cả khi focus chứ không chỉ khi trỏ
 * chuột — `title` trần thì người dùng bàn phím và màn hình cảm ứng không bao giờ thấy.
 */
export function HelpTip({ text, label }: { text: string; label: string }) {
  return (
    <span className="group relative inline-flex flex-none">
      <button
        type="button"
        aria-label={`Cách tính ${label}: ${text}`}
        className="grid size-4 cursor-help place-items-center rounded-full border-0 bg-transparent p-0 text-muted hover:text-ink focus-visible:text-ink"
      >
        <CircleHelp size={14} aria-hidden="true" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute top-full left-0 z-20 mt-1 hidden w-60 rounded-nt border border-border bg-elevated p-2.5 text-[12.5px] leading-snug font-normal text-ink shadow-nt-card group-focus-within:block group-hover:block"
      >
        {text}
      </span>
    </span>
  );
}
