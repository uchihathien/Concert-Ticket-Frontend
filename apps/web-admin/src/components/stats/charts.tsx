'use client';

/*
 * Mọi thứ dùng recharts nằm trong MỘT file, và file này chỉ được nạp qua `lazy-charts.ts`.
 *
 * recharts nặng (kéo theo d3) và chỉ ba trang thống kê cần nó. Nhập thẳng từ một trang là đưa cả
 * gói vào bundle chung của khu dashboard; qua `next/dynamic` thì nó thành một chunk riêng, chỉ tải
 * khi có biểu đồ cần vẽ, và không bao giờ chạy lúc dựng trang ở server.
 */

import type { SalesPoint, StatsBucket } from '@nexaticket/ts-sdk';
import { formatNumber } from '@nexaticket/ui';
import {
  Area,
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { bucketLabel, formatMoney, formatMoneyCompact } from '@/lib/stats-math';

/* Màu lấy từ token của giao diện, không ghi cứng: đổi theme thì biểu đồ đổi theo. */
const INK = 'var(--nt-text)';
const MUTED = 'var(--nt-text-muted)';
const GRID = 'var(--nt-border)';
const PRIMARY = 'var(--nt-primary)';

/** Bảng màu cho các lớp chồng. Đủ khác nhau trên nền tối, và không trùng màu trạng thái đỏ/vàng. */
export const SERIES_COLORS = ['#d5ff66', '#5dd39e', '#6bb8ff', '#c79bff', '#ffb86b', '#ff8fb1', '#8fe3e0', '#b8c27a'];

const AXIS = { stroke: GRID, tick: { fill: MUTED, fontSize: 12 }, tickLine: false } as const;

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="rounded-nt border border-border bg-elevated px-3 py-2 text-[12.5px] text-ink shadow-nt-card">
      <p className="m-0 mb-1 font-semibold">{title}</p>
      {rows.map((row) => (
        <p key={row.label} className="m-0 flex items-center justify-between gap-4 tabular-nums">
          <span className="flex items-center gap-1.5 text-muted">
            {row.color ? <span aria-hidden="true" className="size-2 rounded-full" style={{ background: row.color }} /> : null}
            {row.label}
          </span>
          <span className="font-semibold">{row.value}</span>
        </p>
      ))}
    </div>
  );
}

export interface RevenueTrendProps {
  points: SalesPoint[];
  /** Kỳ trước, đặt chồng theo THỨ TỰ ô (ngày thứ 3 của kỳ này so với ngày thứ 3 của kỳ trước). */
  previous?: SalesPoint[] | null;
  bucket: StatsBucket;
  /** Cộng dồn từ đầu kỳ thay vì vẽ từng ô. */
  cumulative?: boolean;
  height?: number;
}

/**
 * Doanh thu theo thời gian, có đường kỳ trước.
 *
 * Kèm một bảng ẩn cho trình đọc màn hình: SVG của biểu đồ không đọc được, và "doanh thu ngày 12 là
 * bao nhiêu" không được là câu hỏi chỉ người nhìn thấy mới trả lời được.
 */
export function RevenueTrendChart({ points, previous, bucket, cumulative = false, height = 280 }: RevenueTrendProps) {
  let runningNow = 0;
  let runningBefore = 0;
  const data = points.map((point, index) => {
    const before = previous?.[index];
    runningNow += point.grossVnd;
    runningBefore += before?.grossVnd ?? 0;
    return {
      label: bucketLabel(point.bucket, bucket),
      title: bucketLabel(point.bucket, bucket, true),
      beforeTitle: before ? bucketLabel(before.bucket, bucket, true) : null,
      now: cumulative ? runningNow : point.grossVnd,
      before: before ? (cumulative ? runningBefore : before.grossVnd) : null,
      tickets: point.ticketsSold,
      orders: point.ordersPaid,
    };
  });

  return (
    <>
      <div style={{ height }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="nt-revenue-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.28} />
                <stop offset="100%" stopColor={PRIMARY} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" {...AXIS} minTickGap={24} />
            <YAxis {...AXIS} axisLine={false} width={56} tickFormatter={formatMoneyCompact} />
            <Tooltip
              cursor={{ stroke: MUTED, strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                const row = active ? (payload?.[0]?.payload as (typeof data)[number] | undefined) : undefined;
                if (!row) return null;
                const rows = [{ label: cumulative ? 'Lũy kế' : 'Doanh thu', value: formatMoney(row.now), color: PRIMARY }];
                if (row.before !== null) {
                  rows.push({ label: `Kỳ trước (${row.beforeTitle})`, value: formatMoney(row.before), color: MUTED });
                }
                if (!cumulative) {
                  rows.push({ label: 'Vé đã bán', value: formatNumber(row.tickets), color: '' });
                  rows.push({ label: 'Đơn đã trả', value: formatNumber(row.orders), color: '' });
                }
                return <TooltipBox title={row.title} rows={rows} />;
              }}
            />
            {previous ? (
              <Line
                type="monotone"
                dataKey="before"
                stroke={MUTED}
                strokeWidth={1.5}
                strokeDasharray="5 4"
                dot={false}
                isAnimationActive={false}
              />
            ) : null}
            <Area
              type="monotone"
              dataKey="now"
              stroke={PRIMARY}
              strokeWidth={2}
              fill="url(#nt-revenue-fill)"
              dot={false}
              activeDot={{ r: 4, fill: PRIMARY, stroke: INK }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{cumulative ? 'Doanh thu lũy kế' : 'Doanh thu'} theo thời gian</caption>
        <thead>
          <tr>
            <th scope="col">Thời điểm</th>
            <th scope="col">Doanh thu</th>
            {previous ? <th scope="col">Kỳ trước</th> : null}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.title}>
              <th scope="row">{row.title}</th>
              <td>{formatMoney(row.now)}</td>
              {previous ? <td>{row.before === null ? '—' : formatMoney(row.before)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export interface StackedBarsProps {
  /** Mỗi phần tử là một cột; `values[key]` là chiều cao của từng lớp. */
  columns: { key: string; label: string; title: string; values: Record<string, number> }[];
  /** Thứ tự và tên các lớp. */
  layers: string[];
  caption: string;
  height?: number;
}

/** Cột chồng: doanh thu của mỗi suất, tách theo loại vé. */
export function StackedBarsChart({ columns, layers, caption, height = 300 }: StackedBarsProps) {
  const data = columns.map((column) => ({ label: column.label, title: column.title, ...column.values }));
  return (
    <>
      <div style={{ height }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsBarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" {...AXIS} interval={0} tick={{ fill: MUTED, fontSize: 11 }} />
            <YAxis {...AXIS} axisLine={false} width={56} tickFormatter={formatMoneyCompact} />
            <Tooltip
              cursor={{ fill: 'var(--nt-hover)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]?.payload as { title: string };
                const total = payload.reduce((sum, item) => sum + Number(item.value ?? 0), 0);
                return (
                  <TooltipBox
                    title={row.title}
                    rows={[
                      ...payload
                        .filter((item) => Number(item.value ?? 0) > 0)
                        .map((item) => ({
                          label: String(item.name),
                          value: formatMoney(Number(item.value)),
                          color: String(item.color),
                        })),
                      { label: 'Tổng', value: formatMoney(total), color: '' },
                    ]}
                  />
                );
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: MUTED }} iconType="circle" iconSize={8} />
            {layers.map((layer, index) => (
              <Bar
                key={layer}
                dataKey={layer}
                name={layer}
                stackId="total"
                fill={SERIES_COLORS[index % SERIES_COLORS.length]}
                maxBarSize={48}
                isAnimationActive={false}
              />
            ))}
          </RechartsBarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Suất</th>
            {layers.map((layer) => (
              <th key={layer} scope="col">
                {layer}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {columns.map((column) => (
            <tr key={column.key}>
              <th scope="row">{column.title}</th>
              {layers.map((layer) => (
                <td key={layer}>{formatMoney(column.values[layer] ?? 0)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export interface CountBarsProps {
  /** `label` là nhãn trục (ngắn), `title` là nhãn đầy đủ trong chú giải. */
  rows: { key: string; label: string; title: string; value: number; secondary?: number }[];
  caption: string;
  /** Tên của đại lượng chính và phụ, ví dụ "Vé đã bán" / "Lượt ra". */
  valueName: string;
  secondaryName?: string;
  height?: number;
}

/** Cột đếm đơn giản: vé theo ngày, khách vào theo khung 15 phút, số vé mỗi đơn. */
export function CountBarsChart({ rows, caption, valueName, secondaryName, height = 260 }: CountBarsProps) {
  return (
    <>
      <div style={{ height }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsBarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" {...AXIS} minTickGap={16} />
            <YAxis {...AXIS} axisLine={false} width={44} allowDecimals={false} tickFormatter={(value: number) => formatNumber(value)} />
            <Tooltip
              cursor={{ fill: 'var(--nt-hover)' }}
              content={({ active, payload }) => {
                const row = active ? (payload?.[0]?.payload as CountBarsProps['rows'][number] | undefined) : undefined;
                if (!row) return null;
                const lines = [{ label: valueName, value: formatNumber(row.value), color: PRIMARY }];
                if (secondaryName && row.secondary !== undefined) {
                  lines.push({ label: secondaryName, value: formatNumber(row.secondary), color: SERIES_COLORS[2] ?? MUTED });
                }
                return <TooltipBox title={row.title} rows={lines} />;
              }}
            />
            <Bar dataKey="value" name={valueName} fill={PRIMARY} maxBarSize={36} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            {secondaryName ? (
              <Bar dataKey="secondary" name={secondaryName} fill={SERIES_COLORS[2]} maxBarSize={36} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            ) : null}
          </RechartsBarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Mốc</th>
            <th scope="col">{valueName}</th>
            {secondaryName ? <th scope="col">{secondaryName}</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">{row.title}</th>
              <td>{formatNumber(row.value)}</td>
              {secondaryName ? <td>{formatNumber(row.secondary ?? 0)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
