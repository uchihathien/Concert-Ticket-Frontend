import { listMyOrders, type Order, type OrderStatus } from '@nexaticket/ts-sdk';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { api } from '@/lib/api';
import { useMobileAuth } from '@/lib/auth-context';
import { formatSessionTime, loadSessionIndex, type SessionIndex } from '@/lib/session-index';

type Filter = 'paid' | 'all';

const STATUS: Record<OrderStatus, { label: string; color: string; background: string }> = {
  PAID: { label: 'Đã thanh toán', color: '#5DD39E', background: 'rgba(93,211,158,0.14)' },
  AWAITING_PAYMENT: { label: 'Chờ thanh toán', color: '#E0A33E', background: 'rgba(224,163,62,0.14)' },
  EXPIRED: { label: 'Quá hạn', color: '#A6B1A8', background: 'rgba(166,177,168,0.12)' },
  CANCELLED: { label: 'Đã huỷ', color: '#A6B1A8', background: 'rgba(166,177,168,0.12)' },
  REFUNDED: { label: 'Đã hoàn tiền', color: '#8AB4F8', background: 'rgba(138,180,248,0.14)' },
  MANUAL_REVIEW: { label: 'Đang xử lý', color: '#FF8C79', background: 'rgba(255,140,121,0.14)' },
};

/**
 * Đơn hàng của tôi. Mặc định chỉ hiện đơn ĐÃ THANH TOÁN — thứ người ta mở màn này để xem; "Tất
 * cả" thêm đơn chờ thanh toán, quá hạn, đã huỷ. Tên sự kiện tra từ suất diễn (session-index).
 */
export default function OrdersScreen() {
  const { ready, signedIn } = useMobileAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [index, setIndex] = useState<SessionIndex>({});
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<Filter>('paid');
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(
    (force = false) => Promise.all([listMyOrders(api, { limit: 100 }), loadSessionIndex(force)]),
    [],
  );

  const load = useCallback(async (force = false) => {
    try {
      const [list, sessions] = await fetchAll(force);
      setOrders(list);
      setIndex(sessions);
      setError(false);
    } catch {
      setError(true);
      setOrders((current) => current ?? []);
    }
  }, [fetchAll]);

  useEffect(() => {
    if (!ready || !signedIn) return;
    let active = true;
    fetchAll()
      .then(([list, sessions]) => {
        if (!active) return;
        setOrders(list);
        setIndex(sessions);
        setError(false);
      })
      .catch(() => {
        if (!active) return;
        setError(true);
        setOrders([]);
      });
    return () => { active = false; };
  }, [ready, signedIn, fetchAll]);

  const visible = useMemo(
    () => (orders ?? []).filter((order) => filter === 'all' || order.status === 'PAID'),
    [orders, filter],
  );
  const paidCount = (orders ?? []).filter((order) => order.status === 'PAID').length;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenHeader title="Đơn hàng của tôi" />
      {!signedIn ? (
        <Empty title="Cần đăng nhập" detail="Đăng nhập để xem đơn hàng của bạn." />
      ) : orders === null ? (
        <View style={styles.center}><ActivityIndicator color="#D5FF66" /></View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(order) => order.id}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor="#D5FF66" colors={['#D5FF66']} onRefresh={() => { setRefreshing(true); void load(true).finally(() => setRefreshing(false)); }} />}
          ListHeaderComponent={
            <View style={styles.filters}>
              <Chip label={`Đã thanh toán · ${paidCount}`} active={filter === 'paid'} onPress={() => setFilter('paid')} />
              <Chip label={`Tất cả · ${orders.length}`} active={filter === 'all'} onPress={() => setFilter('all')} />
            </View>
          }
          ListEmptyComponent={
            error ? (
              <Empty title="Không tải được đơn hàng" detail="Kiểm tra kết nối rồi kéo xuống để tải lại." />
            ) : (
              <Empty
                title={filter === 'paid' ? 'Chưa có đơn đã thanh toán' : 'Chưa có đơn hàng nào'}
                detail="Đơn sẽ xuất hiện ở đây sau khi bạn giữ chỗ và thanh toán."
              />
            )
          }
          renderItem={({ item }) => <OrderCard order={item} info={index[item.eventSessionId]} />}
        />
      )}
    </SafeAreaView>
  );
}

function OrderCard({ order, info }: { order: Order; info: SessionIndex[string] | undefined }) {
  const status = STATUS[order.status] ?? STATUS.EXPIRED;
  const tickets = order.items.length;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Đơn ${order.orderNumber}, ${status.label}`}
      onPress={() => router.push({ pathname: '/checkout/[orderId]', params: { orderId: order.id, orderNumber: order.orderNumber } })}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardTop}>
        <Text numberOfLines={2} style={styles.event}>{info?.eventTitle ?? 'Sự kiện'}</Text>
        <Text style={[styles.status, { color: status.color, backgroundColor: status.background }]}>{status.label}</Text>
      </View>
      {info ? (
        <Text style={styles.meta}>{formatSessionTime(info.startsAt)}{info.venueName ? ` · ${info.venueName}` : ''}</Text>
      ) : null}
      <View style={styles.divider} />
      <View style={styles.cardBottom}>
        <View>
          <Text style={styles.orderNo}>{order.orderNumber}</Text>
          <Text style={styles.small}>
            {tickets} vé{order.paidAt ? ` · trả lúc ${new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(order.paidAt))}` : ''}
          </Text>
        </View>
        <Text style={styles.total}>{new Intl.NumberFormat('vi-VN').format(order.totalVnd)}đ</Text>
      </View>
    </Pressable>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.small}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111713' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  chip: { minHeight: 36, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: '#344238' },
  chipActive: { backgroundColor: '#D5FF66', borderColor: '#D5FF66' },
  chipText: { color: '#C4CEC5', fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: '#17210D' },
  card: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#344238', backgroundColor: '#19221B' },
  cardPressed: { backgroundColor: '#1F2A22' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  event: { flex: 1, color: '#F1F5F1', fontSize: 16, fontWeight: '800' },
  status: { overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, fontSize: 12, fontWeight: '700' },
  meta: { color: '#A6B1A8', fontSize: 13, marginTop: 6 },
  divider: { height: 1, backgroundColor: '#344238', marginVertical: 12 },
  cardBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  orderNo: { color: '#F1F5F1', fontSize: 13, fontWeight: '700', fontFamily: 'Menlo' },
  small: { color: '#A6B1A8', fontSize: 12, marginTop: 3, lineHeight: 18 },
  total: { color: '#D5FF66', fontSize: 17, fontWeight: '800' },
  empty: { padding: 20, borderRadius: 14, borderWidth: 1, borderColor: '#344238', backgroundColor: '#19221B', gap: 4 },
  emptyTitle: { color: '#F1F5F1', fontSize: 15, fontWeight: '800' },
});
