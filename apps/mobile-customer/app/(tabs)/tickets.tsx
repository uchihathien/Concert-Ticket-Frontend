import { listMyTickets, type Ticket } from '@nexaticket/ts-sdk';
import { SymbolView } from 'expo-symbols';
import { Link } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
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
import { resolveMediaUrl } from '@/lib/media-url';
import { formatSessionTime, loadSessionIndex, type SessionIndex, type SessionInfo } from '@/lib/session-index';

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
  const loading = ready && signedIn && currentResult === null;
  const error = currentResult?.error ?? false;
  // Vé chỉ mang mã suất diễn; tên sự kiện, giờ diễn, địa điểm tra từ danh mục công khai.
  const [index, setIndex] = useState<SessionIndex>({});

  useEffect(() => {
    if (!ready || !signedIn) return;
    let active = true;
    void loadSessionIndex(reload > 0).then((value) => { if (active) setIndex(value); });
    return () => { active = false; };
  }, [ready, signedIn, reload]);

  // Suất sắp diễn lên đầu; vé chưa tra được suất xếp cuối, giữ thứ tự gốc.
  const sorted = useMemo(
    () => [...(currentResult?.tickets ?? [])].sort((a, b) => (index[a.eventSessionId]?.startsAt ?? '9999').localeCompare(index[b.eventSessionId]?.startsAt ?? '9999')),
    [currentResult, index],
  );

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
        data={signedIn ? sorted : []}
        keyExtractor={(ticket) => ticket.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading && signedIn}
            onRefresh={() => {
              setReload((value) => value + 1);
            }}
            tintColor="#D5FF66"
            colors={['#D5FF66']}
          />
        }
        ListHeaderComponent={
          <>
            <Text style={styles.eyebrow}>NEXATICKET / VÍ</Text>
            <Text style={styles.title}>Vé của tôi</Text>
          </>
        }
        renderItem={({ item }) => <TicketCard ticket={item} info={index[item.eventSessionId]} onPress={() => setSelected(item)} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.iconWrap}>
              {loading ? <ActivityIndicator color="#D5FF66" /> : <SymbolView name={{ ios: 'ticket.fill', android: 'confirmation_number', web: 'confirmation_number' }} tintColor="#D5FF66" size={28} />}
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
                <Text numberOfLines={2} style={styles.modalTitle}>{index[selected.eventSessionId]?.eventTitle ?? selected.ticketTypeName}</Text>
                {index[selected.eventSessionId] ? (
                  <Text style={styles.modalMeta}>
                    {formatSessionTime(index[selected.eventSessionId].startsAt)}
                    {index[selected.eventSessionId].venueName ? ` · ${index[selected.eventSessionId].venueName}` : ''}
                  </Text>
                ) : null}
                <Text style={styles.modalSeat}>{selected.ticketTypeName} · {seatText(selected)}</Text>
                <View style={styles.qrFrame}>
                  <QRCode value={selected.qrToken} size={220} backgroundColor="#FFFFFF" color="#111713" />
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

function TicketCard({ ticket, info, onPress }: { ticket: Ticket; info: SessionInfo | undefined; onPress: () => void }) {
  const valid = ticket.status === 'VALID';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Mở mã vé ${info?.eventTitle ?? ''} ${ticket.ticketTypeName}`}
      onPress={onPress}
      style={({ pressed }) => [styles.ticketCard, pressed && styles.ticketPressed]}
    >
      {/* Phần sự kiện: ảnh + tên + suất + địa điểm — thứ người ta cần biết trước khi tới cửa. */}
      <View style={styles.eventRow}>
        <View style={styles.thumb}>
          {info?.posterUrl ? (
            <Image source={{ uri: resolveMediaUrl(info.posterUrl) }} resizeMode="cover" style={styles.thumbImage} />
          ) : (
            <SymbolView name={{ ios: 'ticket.fill', android: 'confirmation_number', web: 'confirmation_number' }} tintColor="#D5FF66" size={22} />
          )}
        </View>
        <View style={styles.eventText}>
          <Text numberOfLines={2} style={styles.eventTitle}>{info?.eventTitle ?? 'Sự kiện'}</Text>
          {info ? (
            <>
              <Text style={styles.eventMeta}>{formatSessionTime(info.startsAt)}</Text>
              <Text numberOfLines={1} style={styles.eventMeta}>{[info.venueName, info.city].filter(Boolean).join(' · ') || 'Đang cập nhật địa điểm'}</Text>
            </>
          ) : null}
        </View>
      </View>

      {/* Đường răng cưa giữa thân vé và cuống vé. */}
      <View style={styles.perforation} />

      <View style={styles.ticketBottom}>
        <View style={{ flex: 1 }}>
          <Text style={styles.ticketName}>{ticket.ticketTypeName}</Text>
          <Text style={styles.ticketMeta}>{seatText(ticket)} · Mã {ticket.id.slice(0, 8).toUpperCase()}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Text style={[styles.ticketStatus, valid && styles.ticketStatusValid]}>{ticketStatus(ticket.status)}</Text>
          <Text style={styles.viewQr}>Xem mã QR ›</Text>
        </View>
      </View>
    </Pressable>
  );
}

function seatText(ticket: Ticket) {
  // Vé đứng không có số ghế: hiện tên khu thay vì để trống (frontend.md §8).
  if (ticket.seatLabel) return `Ghế ${ticket.seatLabel}`;
  if (ticket.seatCode) return `Ghế ${ticket.seatCode}`;
  return ticket.admissionType === 'STANDING' ? `Vé đứng · khu ${ticket.zoneCode}` : `Khu ${ticket.zoneCode}`;
}

function ticketStatus(status: Ticket['status']) {
  if (status === 'VALID') return 'CÒN HIỆU LỰC';
  if (status === 'CHECKED_IN') return 'ĐÃ CHECK-IN';
  return 'ĐÃ THU HỒI';
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111713' },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 30, paddingBottom: 24 },
  eyebrow: { color: '#D5FF66', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: '#F1F5F1', fontSize: 28, fontWeight: '800', marginTop: 8, marginBottom: 20 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 70 },
  iconWrap: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: '#1F2A22', marginBottom: 18 },
  emptyTitle: { color: '#F1F5F1', fontSize: 19, fontWeight: '800' },
  body: { maxWidth: 270, color: '#A6B1A8', fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  loginButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 20, marginTop: 18, borderRadius: 9, backgroundColor: '#D5FF66' },
  loginText: { color: '#17210D', fontSize: 13, fontWeight: '800' },
  ticketCard: { padding: 14, marginBottom: 12, borderRadius: 14, borderWidth: 1, borderColor: '#344238', backgroundColor: '#19221B' },
  ticketPressed: { backgroundColor: '#1F2A22' },
  eventRow: { flexDirection: 'row', gap: 12 },
  thumb: { width: 74, height: 74, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 10, backgroundColor: '#1F2A22' },
  thumbImage: { width: '100%', height: '100%' },
  eventText: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 3 },
  eventTitle: { color: '#F1F5F1', fontSize: 16, fontWeight: '800', lineHeight: 21 },
  eventMeta: { color: '#C4CEC5', fontSize: 12, lineHeight: 17 },
  perforation: { height: 0, marginVertical: 13, borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#3B493F' },
  ticketStatus: { color: '#A6B1A8', fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  ticketStatusValid: { color: '#5DD39E' },
  ticketName: { color: '#F1F5F1', fontSize: 14, fontWeight: '800' },
  ticketMeta: { color: '#A6B1A8', fontSize: 12, marginTop: 3 },
  ticketBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  ticketId: { color: '#87938A', fontSize: 11 },
  viewQr: { color: '#D5FF66', fontSize: 12, fontWeight: '800' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.72)' },
  ticketModal: { alignItems: 'center', paddingHorizontal: 22, paddingTop: 26, paddingBottom: 38, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: '#19221B' },
  closeButton: { position: 'absolute', top: 10, right: 15, width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#C4CEC5', fontSize: 27 },
  modalEyebrow: { color: '#D5FF66', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  modalTitle: { color: '#F1F5F1', fontSize: 18, fontWeight: '800', marginTop: 6 },
  modalMeta: { color: '#A6B1A8', fontSize: 13, marginTop: 4, textAlign: 'center' },
  modalSeat: { color: '#F1F5F1', fontSize: 14, fontWeight: '700', marginTop: 8 },
  qrFrame: { padding: 13, marginTop: 20, borderRadius: 12, backgroundColor: '#FFFFFF' },
  statusLabel: { color: '#5DD39E', fontSize: 11, fontWeight: '900', marginTop: 17 },
  qrHint: { color: '#A6B1A8', fontSize: 11, marginTop: 8 },
});