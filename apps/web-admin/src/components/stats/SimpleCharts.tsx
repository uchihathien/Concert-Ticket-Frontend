import { formatNumber } from '@nexaticket/ui';
import type { SalesHeatCell } from '@nexaticket/ts-sdk';
import { fillTone, formatMoney, formatPercent } from '@/lib/stats-math';

/*
 * Biểu đồ đủ đơn giản để không cần thư viện: thanh tỉ lệ và lưới nhiệt. Chúng là HTML thường nên
 * dựng được ở server, đọc được bằng trình đọc màn hình, và không kéo recharts vào trang.
 */

const TONE_BG = { danger: 'bg-danger', warn: 'bg-warn', success: 'bg-success', none: 'bg-border' } as const;
const TONE_TEXT = {
  danger: 'text-danger-text',
  warn: 'text-warn-text',
  success: 'text-success-text',
  none: 'text-muted',
} as const;

export interface RatioRow {
  key: string;
  label: string;
  sublabel?: string;
  part: number;
  whole: number;
}

/**
 * Danh sách thanh tỉ lệ (lấp đầy, tỉ lệ đến), tô màu theo ngưỡng: dưới 30% đỏ, 30–70% vàng, trên
 * 70% xanh. Màu không đứng một mình — con số phần trăm luôn nằm cạnh thanh.
 */
export function RatioBars({ rows, caption, unit }: { rows: RatioRow[]; caption: string; unit: string }) {
  return (
    <figure className="m-0 grid gap-3">
      <figcaption className="text-[14px] font-semibold text-ink">{caption}</figcaption>
      <ul className="m-0 grid list-none gap-2.5 p-0">
        {rows.map((row) => {
          const value = row.whole > 0 ? row.part / row.whole : null;
          const tone = fillTone(value);
          return (
            <li key={row.key} className="grid gap-1">
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="min-w-0 truncate text-ink" title={row.sublabel ? `${row.label} · ${row.sublabel}` : row.label}>
                  {row.label}
                  {row.sublabel ? <span className="text-muted"> · {row.sublabel}</span> : null}
                </span>
                <span className="flex-none tabular-nums text-muted">
                  {formatNumber(row.part)}/{formatNumber(row.whole)} {unit}{' '}
                  <strong className={`font-semibold ${TONE_TEXT[tone]}`}>{formatPercent(value)}</strong>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-bg-subtle">
                <div
                  className={`h-full rounded-full ${TONE_BG[tone]}`}
                  style={{ width: `${value === null ? 0 : Math.min(100, value * 100)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

const DAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/**
 * Doanh thu theo thứ trong tuần × giờ trong ngày.
 *
 * Là một `<table>` thật: mỗi ô có nhãn đầy đủ cho trình đọc màn hình, và độ đậm chỉ là lớp trình
 * bày chồng lên — trỏ vào ô nào cũng đọc được con số của ô ấy.
 */
export function Heatmap({ cells }: { cells: SalesHeatCell[] }) {
  const byKey = new Map(cells.map((cell) => [`${cell.dayOfWeek}-${cell.hour}`, cell]));
  const max = cells.reduce((top, cell) => Math.max(top, cell.grossVnd), 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-separate border-spacing-[3px] text-[11px] text-muted">
        <caption className="sr-only">Doanh thu theo thứ trong tuần và giờ trong ngày</caption>
        <thead>
          <tr>
            <td />
            {HOURS.map((hour) => (
              <th key={hour} scope="col" className="font-normal tabular-nums">
                {hour}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DAYS.map((day, index) => (
            <tr key={day}>
              <th scope="row" className="pr-2 text-right font-normal whitespace-nowrap">
                {day}
              </th>
              {HOURS.map((hour) => {
                const cell = byKey.get(`${index + 1}-${hour}`);
                const strength = cell && max > 0 ? cell.grossVnd / max : 0;
                const label = cell
                  ? `${day}, ${hour}:00–${hour + 1}:00 — ${formatMoney(cell.grossVnd)}, ${formatNumber(cell.ordersPaid)} đơn`
                  : `${day}, ${hour}:00–${hour + 1}:00 — không có đơn`;
                return (
                  <td key={hour} title={label} className="p-0">
                    <div
                      className="h-6 rounded-[4px] border border-border"
                      style={{
                        // Sàn 12% để ô có đơn không bao giờ lẫn với ô trống.
                        background: cell
                          ? `color-mix(in srgb, var(--nt-primary) ${Math.round(12 + strength * 88)}%, transparent)`
                          : 'transparent',
                      }}
                    >
                      <span className="sr-only">{label}</span>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
