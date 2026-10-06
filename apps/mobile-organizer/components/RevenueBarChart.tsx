import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export interface EventRevenue {
  eventId: string;
  title: string;
  grossVnd: number;
  ticketsSold: number;
  ordersPaid: number;
  ordersExpired: number;
  ordersCancelled: number;
  sessionCount: number;
}

/** Số thanh tối đa; phần còn lại gộp thành "Khác" thay vì kéo dài biểu đồ. */
const MAX_BARS = 6;

/*
 * Màu thanh: xanh chanh TRẦM, cùng họ với màu nhấn #D5FF66 của app.
 *
 * #D5FF66 không qua được kiểm tra dải độ sáng cho nền tối (OKLCH L 0.94, dải cho phép 0.48–0.67):
 * một khối màu sáng cỡ đó trên nền tối chói và át phần chữ. #76A02A (L 0.67) đạt cả dải độ sáng,
 * độ bão hoà và tương phản ≥ 3:1 trên nền thẻ #19221B (kiểm bằng validate_palette của skill dataviz).
 */
const BAR_COLOR = '#76A02A';

/**
 * Doanh thu theo sự kiện — biểu đồ thanh ngang, một chuỗi, sắp giảm dần.
 *
 * Ngang chứ không dọc: tên sự kiện dài và màn điện thoại hẹp; nhãn nằm trên thanh đọc trọn được.
 * Một chuỗi nên không có chú thích — tiêu đề mục đã nói thanh là gì. Điện thoại không có hover,
 * nên chạm vào một dòng mở phần chi tiết (vé, đơn đã trả/hết hạn/huỷ) ngay dưới biểu đồ.
 */
export function RevenueBarChart({ rows, formatMoney }: { rows: EventRevenue[]; formatMoney: (value: number) => string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const withRevenue = rows.filter((row) => row.grossVnd > 0).sort((a, b) => b.grossVnd - a.grossVnd);
  const noRevenueCount = rows.length - withRevenue.length;

  if (withRevenue.length === 0) {
    return <Text style={styles.empty}>Chưa có sự kiện nào phát sinh doanh thu.</Text>;
  }

  const shown = withRevenue.slice(0, MAX_BARS);
  const rest = withRevenue.slice(MAX_BARS);
  const bars: EventRevenue[] = rest.length
    ? [
        ...shown,
        rest.reduce<EventRevenue>(
          (sum, row) => ({
            ...sum,
            grossVnd: sum.grossVnd + row.grossVnd,
            ticketsSold: sum.ticketsSold + row.ticketsSold,
            ordersPaid: sum.ordersPaid + row.ordersPaid,
            ordersExpired: sum.ordersExpired + row.ordersExpired,
            ordersCancelled: sum.ordersCancelled + row.ordersCancelled,
            sessionCount: sum.sessionCount + row.sessionCount,
          }),
          {
            eventId: '__other__',
            title: `Khác (${rest.length} sự kiện)`,
            grossVnd: 0,
            ticketsSold: 0,
            ordersPaid: 0,
            ordersExpired: 0,
            ordersCancelled: 0,
            sessionCount: 0,
          },
        ),
      ]
    : shown;

  const max = Math.max(...bars.map((row) => row.grossVnd));
  const selected = bars.find((row) => row.eventId === selectedId) ?? null;

  return (
    <View>
      {bars.map((row) => {
        const isSelected = row.eventId === selectedId;
        // Sàn 2%: một sự kiện doanh thu rất nhỏ vẫn hiện ra một vạch, không biến mất khỏi biểu đồ.
        const widthPercent = Math.max(2, (row.grossVnd / max) * 100);
        return (
          <Pressable
            key={row.eventId}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${row.title}: ${formatMoney(row.grossVnd)}, ${row.ticketsSold} vé`}
            accessibilityHint="Chạm để xem chi tiết đơn hàng"
            onPress={() => setSelectedId(isSelected ? null : row.eventId)}
            style={({ pressed }) => [styles.row, isSelected && styles.rowSelected, pressed && styles.rowPressed]}
          >
            <View style={styles.labelLine}>
              <Text numberOfLines={1} style={styles.name}>{row.title}</Text>
              <Text style={styles.value}>{formatMoney(row.grossVnd)}</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.bar, { width: `${widthPercent}%` }]} />
            </View>
          </Pressable>
        );
      })}

      {selected ? (
        <View style={styles.detail} accessibilityLiveRegion="polite">
          <Text style={styles.detailTitle}>{selected.title}</Text>
          <View style={styles.detailGrid}>
            <Metric label="Doanh thu" value={formatMoney(selected.grossVnd)} />
            <Metric label="Vé đã bán" value={String(selected.ticketsSold)} />
            <Metric label="Suất diễn" value={String(selected.sessionCount)} />
            <Metric label="Đơn đã trả" value={String(selected.ordersPaid)} />
            <Metric label="Hết hạn" value={String(selected.ordersExpired)} />
            <Metric label="Đã huỷ" value={String(selected.ordersCancelled)} />
          </View>
        </View>
      ) : (
        <Text style={styles.hint}>Chạm vào một sự kiện để xem chi tiết.</Text>
      )}

      {noRevenueCount > 0 ? (
        <Text style={styles.hint}>{noRevenueCount} sự kiện khác chưa có doanh thu.</Text>
      ) : null}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Vùng chạm cả dòng (≥ 44px), lớn hơn nhiều so với chính thanh 14px.
  row: { minHeight: 52, justifyContent: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 8, marginHorizontal: -8, borderRadius: 8 },
  rowSelected: { backgroundColor: '#20291C' },
  rowPressed: { backgroundColor: '#1C261F' },
  labelLine: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  // Chữ dùng màu chữ, không dùng màu dữ liệu.
  name: { flex: 1, color: '#F1F5F1', fontSize: 13, fontWeight: '700' },
  value: { color: '#CAD3CB', fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  // Đường gốc chung bên trái; thanh mọc từ đó.
  track: { height: 14, justifyContent: 'center' },
  bar: { height: 14, backgroundColor: BAR_COLOR, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  detail: { marginTop: 10, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#344238', backgroundColor: '#151D17', gap: 10 },
  detailTitle: { color: '#F1F5F1', fontSize: 14, fontWeight: '800' },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10 },
  metric: { width: '33.33%' },
  metricValue: { color: '#F1F5F1', fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  metricLabel: { color: '#A6B1A8', fontSize: 11, marginTop: 2 },
  hint: { color: '#A6B1A8', fontSize: 12, marginTop: 10 },
  empty: { color: '#A6B1A8', fontSize: 13 },
});
