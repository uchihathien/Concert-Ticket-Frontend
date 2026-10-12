import { getOrder, type Order } from '@nexaticket/ts-sdk';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';

export default function CheckoutScreen() {
  const { orderId, orderNumber } = useLocalSearchParams<{ orderId: string; orderNumber?: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState(false);
  const [reload, setReload] = useState(0);
  const [now, setNow] = useState(0);
  const orderStatus = useRef<Order['status'] | null>(null);

  useEffect(() => {
    let active = true;
    let requesting = false;
    const load = async () => {
      if (requesting || orderStatus.current === 'PAID') return;
      requesting = true;
      try {
        const fresh = await getOrder(api, orderId);
        if (active) {
          orderStatus.current = fresh.status;
          setOrder(fresh);
          setFailure(false);
        }
      } catch {
        if (active && orderStatus.current === null) setFailure(true);
      } finally {
        requesting = false;
        if (active) setLoading(false);
      }
    };
    void load();
    const interval = setInterval(() => void load(), 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [orderId, reload]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const remainingMs = now > 0 && order?.paymentExpiresAt ? Math.max(0, new Date(order.paymentExpiresAt).getTime() - now) : 0;
  const remainingMinutes = Math.floor(remainingMs / 60_000);
  const remainingSeconds = Math.floor((remainingMs % 60_000) / 1000);

  async function openPayment() {
    if (!order?.checkoutUrl) return;
    await WebBrowser.openBrowserAsync(order.checkoutUrl);
    setReload((value) => value + 1);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Thanh toán</Text>
        <View style={styles.backButton} />
      </View>

      {loading && !order ? (
        <View style={styles.centerState}><ActivityIndicator color="#D5FF66" size="large" /></View>
      ) : failure && !order ? (
        <View style={styles.centerState}>
          <Text style={styles.title}>Chưa tải được đơn hàng</Text>
          <Pressable onPress={() => { setLoading(true); setReload((value) => value + 1); }} style={styles.primaryButton}>
            <Text style={styles.buttonText}>Thử lại</Text>
          </Pressable>
        </View>
      ) : order ? (
        <View style={styles.content}>
          <View style={[styles.statusMark, order.status === 'PAID' && styles.paidMark]}>
            <Text style={styles.statusGlyph}>{order.status === 'PAID' ? '✓' : '₫'}</Text>
          </View>
          <Text style={styles.eyebrow}>ĐƠN HÀNG {order.orderNumber || orderNumber}</Text>
          <Text style={styles.title}>{statusLabel(order.status)}</Text>
          <Text style={styles.body}>{order.status === 'PAID' ? 'Thanh toán đã được xác nhận. Vé sẽ xuất hiện trong mục Vé của tôi.' : 'Hoàn tất thanh toán để xác nhận vé của bạn.'}</Text>

          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.muted}>Tổng thanh toán</Text>
              <Text style={styles.amount}>{formatPrice(order.totalVnd)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.muted}>Mã đơn</Text>
              <Text style={styles.summaryValue}>{order.orderNumber}</Text>
            </View>
            {order.status === 'AWAITING_PAYMENT' && remainingMs > 0 ? (
              <View style={styles.summaryRow}>
                <Text style={styles.muted}>Thời gian còn lại</Text>
                <Text style={styles.countdown}>{String(remainingMinutes).padStart(2, '0')}:{String(remainingSeconds).padStart(2, '0')}</Text>
              </View>
            ) : null}
          </View>

          {order.status === 'AWAITING_PAYMENT' ? (
            order.checkoutUrl ? (
              <Pressable accessibilityRole="button" onPress={() => void openPayment()} style={styles.primaryButton}>
                <Text style={styles.buttonText}>Mở cổng thanh toán</Text>
              </Pressable>
            ) : (
              <View style={styles.notice}><Text style={styles.body}>Cổng thanh toán chưa trả về liên kết. Mã chuyển khoản: {order.paymentReference ?? 'đang cập nhật'}</Text></View>
            )
          ) : null}
          <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Về trang khám phá</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function statusLabel(status: Order['status']) {
  switch (status) {
    case 'PAID': return 'Đã thanh toán';
    case 'AWAITING_PAYMENT': return 'Chờ thanh toán';
    case 'EXPIRED': return 'Đơn đã hết hạn';
    case 'CANCELLED': return 'Đơn đã hủy';
    case 'REFUNDED': return 'Đã hoàn tiền';
    case 'MANUAL_REVIEW': return 'Đang được kiểm tra';
  }
}

function formatPrice(value: number) {
  return `${new Intl.NumberFormat('vi-VN').format(value)}đ`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111713' },
  header: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#344238' },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backGlyph: { color: '#F1F5F1', fontSize: 36, lineHeight: 40 },
  headerTitle: { color: '#F1F5F1', fontSize: 14, fontWeight: '700' },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 22, paddingBottom: 44 },
  statusMark: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#1F2A22', marginBottom: 22 },
  paidMark: { backgroundColor: '#1F4C37' },
  statusGlyph: { color: '#D5FF66', fontSize: 27, fontWeight: '900' },
  eyebrow: { color: '#D5FF66', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#F1F5F1', fontSize: 26, fontWeight: '900', marginTop: 7 },
  body: { color: '#A6B1A8', fontSize: 13, lineHeight: 20, marginTop: 8 },
  summary: { padding: 17, marginTop: 25, marginBottom: 18, borderRadius: 13, borderWidth: 1, borderColor: '#344238', backgroundColor: '#19221B' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 8 },
  muted: { color: '#A6B1A8', fontSize: 12 },
  amount: { color: '#D5FF66', fontSize: 16, fontWeight: '900' },
  summaryValue: { color: '#F1F5F1', fontSize: 12, fontWeight: '700' },
  countdown: { color: '#D5FF66', fontSize: 13, fontWeight: '900' },
  divider: { height: 1, backgroundColor: '#344238', marginVertical: 7 },
  primaryButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, borderRadius: 10, backgroundColor: '#D5FF66' },
  buttonText: { color: '#17210D', fontSize: 14, fontWeight: '900' },
  secondaryButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 9 },
  secondaryText: { color: '#C4CEC5', fontSize: 13, fontWeight: '700' },
  notice: { padding: 14, borderRadius: 10, backgroundColor: '#1F2A22' },
});