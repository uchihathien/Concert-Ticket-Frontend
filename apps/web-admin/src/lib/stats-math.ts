import type { StatsBucket } from '@nexaticket/ts-sdk';
import { formatNumber } from '@nexaticket/ui';

/** `null` khi mẫu số bằng 0: một tỉ lệ không tính được phải hiện "—", không phải 0%. */
export function ratio(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null;
}

export function formatPercent(value: number | null, digits = 0): string {
  if (value === null) return '—';
  return `${(value * 100).toLocaleString('vi-VN', { maximumFractionDigits: digits })}%`;
}

export function formatMoney(value: number): string {
  return `${formatNumber(Math.round(value))} ₫`;
}

/** Tiền rút gọn cho trục biểu đồ: 1,2 tỷ · 350 tr · 80 k. */
export function formatMoneyCompact(value: number): string {
  const abs = Math.abs(value);
  const trim = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
  if (abs >= 1_000_000_000) return `${trim(value / 1_000_000_000)} tỷ`;
  if (abs >= 1_000_000) return `${trim(value / 1_000_000)} tr`;
  if (abs >= 1_000) return `${trim(value / 1_000)} k`;
  return String(value);
}

export function formatDurationShort(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return `${Math.round(seconds)} giây`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return rest === 0 ? `${minutes} phút` : `${minutes} phút ${rest} giây`;
}

export interface Delta {
  /** Phần trăm thay đổi so với kỳ trước; `null` khi kỳ trước bằng 0 (không chia được). */
  percent: number | null;
  direction: 'up' | 'down' | 'flat';
  /** Kỳ trước bằng 0 mà kỳ này có số. */
  fromZero: boolean;
}

export function delta(current: number | null, previous: number | null | undefined): Delta | null {
  if (current === null || previous === null || previous === undefined) return null;
  if (previous === 0) {
    return { percent: null, direction: current > 0 ? 'up' : 'flat', fromZero: current > 0 };
  }
  const percent = (current - previous) / previous;
  return {
    percent,
    direction: Math.abs(percent) < 0.0005 ? 'flat' : percent > 0 ? 'up' : 'down',
    fromZero: false,
  };
}

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/** Nhãn một ô thời gian. `bucket` là giờ Việt Nam không kèm múi giờ, nên đọc thẳng từ chuỗi. */
export function bucketLabel(bucket: string, unit: StatsBucket, long = false): string {
  const [date = '', time = ''] = bucket.split('T');
  const [year, month, day] = date.split('-');
  const short = `${day}/${month}`;
  if (unit === 'hour') return long ? `${time.slice(0, 5)} ${short}` : time.slice(0, 5);
  if (unit === 'week') return long ? `Tuần từ ${short}/${year}` : short;
  if (!long) return short;
  const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
  return `${weekday}, ${short}/${year}`;
}

export function formatDay(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

/** Màu theo mức lấp đầy: dưới 30% đỏ, 30–70% vàng, trên 70% xanh. */
export function fillTone(value: number | null): 'danger' | 'warn' | 'success' | 'none' {
  if (value === null) return 'none';
  if (value < 0.3) return 'danger';
  if (value <= 0.7) return 'warn';
  return 'success';
}
