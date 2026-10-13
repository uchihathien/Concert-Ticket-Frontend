'use client';

import { Skeleton } from '@nexaticket/ui';
import dynamic from 'next/dynamic';

/*
 * Cửa duy nhất để dùng biểu đồ recharts. `ssr: false` vì recharts đo kích thước khung chứa bằng DOM
 * — dựng ở server chỉ ra một khung rỗng rồi nháy khi trình duyệt vẽ lại.
 */

function ChartFallback() {
  return (
    <div className="grid h-[280px] content-center">
      <Skeleton lines={5} />
    </div>
  );
}

export const RevenueTrendChart = dynamic(() => import('./charts').then((module) => module.RevenueTrendChart), {
  ssr: false,
  loading: ChartFallback,
});

export const StackedBarsChart = dynamic(() => import('./charts').then((module) => module.StackedBarsChart), {
  ssr: false,
  loading: ChartFallback,
});

export const CountBarsChart = dynamic(() => import('./charts').then((module) => module.CountBarsChart), {
  ssr: false,
  loading: ChartFallback,
});
