import { listMyTickets, type Ticket } from '@nexaticket/ts-sdk';
import { SymbolView } from 'expo-symbols';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { useMobileAuth } from '@/lib/auth-context';

export default function TicketsScreen() {
  const { ready, signedIn } = useMobileAuth();
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [reload, setReload] = useState(0);
  const requestSignature = `${ready}:${signedIn}:${reload}`;
  const [result, setResult] = useState<{
    signature: string;
    tickets: Ticket[];
    error: boolean;
  } | null>(null);
  const currentResult = result?.signature === requestSignature ? result : null;
  const tickets = currentResult?.tickets ?? [];
  const loading = ready && signedIn && currentResult === null;
  const error = currentResult?.error ?? false;

  useEffect(() => {
    if (!ready || !signedIn) return;

    let active = true;
    listMyTickets(api, { limit: 100 })
      .then((result) => {
        if (active) setResult({ signature: requestSignature, tickets: result, error: false });
      })
      .catch(() => {
        if (active) setResult({ signature: requestSignature, tickets: [], error: true });
      });

    return () => {
      active = false;
    };
  }, [ready, signedIn, reload, requestSignature]);

  return (
    <SafeAreaView style={styles.screen}>
      <FlatList
        data={signedIn ? tickets : []}
        keyExtractor={(ticket) => ticket.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading && signedIn}
            onRefresh={() => {
              setReload((value) => value + 1);
            }}
            tintColor="#F2B705"
            colors={['#F2B705']}
          />
        }
        ListHeaderComponent={
          <>
            <Text style={styles.eyebrow}>NEXATICKET / VÍ</Text>
            <Text style={styles.title}>Vé của tôi</Text>
          </>
        }
        renderItem={({ item }) => <TicketCard ticket={item} onPress={() => setSelected(item)} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.iconWrap}>
              {loading ? <ActivityIndicator color="#F2B705" /> : <SymbolView name={{ ios: 'ticket.fill', android: 'confirmation_number', web: 'confirmation_number' }} tintColor="#F2B705" size={28} />}
            </View>
            <Text style={styles.emptyTitle}>
              {!ready ? 'Đang kiểm tra phiên...' : !signedIn ? 'Đăng nhập để xem vé' : error ? 'Chưa tải được vé' : loading ? 'Đang tải vé...' : 'Chưa có vé nào'}
            </Text>
            <Text style={styles.body}>
              {error ? 'Kiểm tra kết nối rồi thử tải lại.' : signedIn ? 'Vé đã mua sẽ xuất hiện tại đây.' : 'Dùng tài khoản đã mua vé để xem mã vé và thông tin check-in.'}
            </Text>
            {!signedIn && ready ? (
              <Link href="/login" asChild>
                <Pressable accessibilityRole="button" style={styles.loginButton}>
                  <Text style={styles.loginText}>Đăng nhập</Text>
                </Pressable>
              </Link>
            ) : error ? (
              <Pressable accessibilityRole="button" onPress={() => setReload((value) => value + 1)} style={styles.loginButton}>
                <Text style={styles.loginText}>Thử lại</Text>
              </Pressable>
            ) : null}
          </View>
        }
      />
      <Modal visible={selected !== null} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.ticketModal}>
            <Pressable accessibilityRole="button" accessibilityLabel="Đóng mã vé" onPress={() => setSelected(null)} style={styles.closeButton}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
            {selected ? (
              <>
                <Text style={styles.modalEyebrow}>VÉ ĐIỆN TỬ</Text>
                <Text style={styles.modalTitle}>{selected.ticketTypeName}</Text>
                <Text style={styles.modalMeta}>{selected.seatLabel ?? selected.seatCode ?? `Khu ${selected.zoneCode}`}</Text>
                <View style={styles.qrFrame}>
                  <QRCode value={selected.qrToken} size={220} backgroundColor="#FFFFFF" color="#171211" />
                </View>
                <Text style={styles.statusLabel}>{ticketStatus(selected.status)}</Text>
                <Text style={styles.ticketId}>Mã vé {selected.id.slice(0, 8).toUpperCase()}</Text>
                <Text style={styles.qrHint}>Đưa mã này cho nhân viên tại cổng soát vé.</Text>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function TicketCard({ ticket, onPress }: { ticket: Ticket; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Mở mã vé ${ticket.ticketTypeName}`} onPress={onPress} style={styles.ticketCard}>
      <View style={styles.ticketTop}>
        <View style={styles.ticketIcon}>
          <SymbolView name={{ ios: 'ticket.fill', android: 'confirmation_number', web: 'confirmation_number' }} tintColor="#F2B705" size={20} />
        </View>
        <Text style={[styles.ticketStatus, ticket.status === 'VALID' && styles.ticketStatusValid]}>{ticketStatus(ticket.status)}</Text>
      </View>
      <Text style={styles.ticketName}>{ticket.ticketTypeName}</Text>
      <Text style={styles.ticketMeta}>{ticket.seatLabel ?? ticket.seatCode ?? `Khu ${ticket.zoneCode}`}</Text>
      <View style={styles.ticketBottom}>
        <Text style={styles.ticketId}>Mã {ticket.id.slice(0, 8).toUpperCase()}</Text>
        <Text style={styles.viewQr}>Xem mã QR  ›</Text>
      </View>
    </Pressable>
  );
}

function ticketStatus(status: Ticket['status']) {
  if (status === 'VALID') return 'CÒN HIỆU LỰC';
  if (status === 'CHECKED_IN') return 'ĐÃ CHECK-IN';
  return 'ĐÃ THU HỒI';
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#171211' },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 30, paddingBottom: 24 },
  eyebrow: { color: '#F4796B', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: '#F5F1EF', fontSize: 28, fontWeight: '800', marginTop: 8, marginBottom: 20 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 70 },
  iconWrap: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: '#2A2321', marginBottom: 18 },
  emptyTitle: { color: '#F5F1EF', fontSize: 19, fontWeight: '800' },
  body: { maxWidth: 270, color: '#A89E99', fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  loginButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 20, marginTop: 18, borderRadius: 9, backgroundColor: '#C02A2A' },
  loginText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  ticketCard: { padding: 15, marginBottom: 11, borderRadius: 13, borderWidth: 1, borderColor: '#362E2B', backgroundColor: '#211B19' },
  ticketTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#2A2321' },
  ticketStatus: { color: '#A89E99', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  ticketStatusValid: { color: '#4CB782' },
  ticketName: { color: '#F5F1EF', fontSize: 15, fontWeight: '800', marginTop: 13 },
  ticketMeta: { color: '#C9C0BB', fontSize: 12, marginTop: 4 },
  ticketBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6, paddingTop: 12, marginTop: 13, borderTopWidth: 1, borderTopColor: '#362E2B' },
  ticketId: { color: '#817671', fontSize: 10 },
  viewQr: { color: '#F2B705', fontSize: 11, fontWeight: '800' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.72)' },
  ticketModal: { alignItems: 'center', paddingHorizontal: 22, paddingTop: 26, paddingBottom: 38, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: '#211B19' },
  closeButton: { position: 'absolute', top: 10, right: 15, width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#C9C0BB', fontSize: 27 },
  modalEyebrow: { color: '#F4796B', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  modalTitle: { color: '#F5F1EF', fontSize: 18, fontWeight: '800', marginTop: 6 },
  modalMeta: { color: '#A89E99', fontSize: 12, marginTop: 4 },
  qrFrame: { padding: 13, marginTop: 20, borderRadius: 12, backgroundColor: '#FFFFFF' },
  statusLabel: { color: '#4CB782', fontSize: 11, fontWeight: '900', marginTop: 17 },
  qrHint: { color: '#A89E99', fontSize: 11, marginTop: 8 },
});