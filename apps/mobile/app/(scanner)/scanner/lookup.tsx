import {
  ApiError,
  admitByLookup,
  lookupTickets,
  type CheckinBundleTicket,
  type GateScanResponse,
} from '@nexaticket/ts-sdk';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { isNetworkFailure, useOnline } from '@/lib/offline/network';
import { deviceId, hasBundle, scanOffline, searchOffline } from '@/lib/offline/store';
import { TONE_COLORS, formatClock, verdictOf, vibrateFor } from '@/lib/scan-verdicts';

/**
 * Tìm khách quên vé (hoặc điện thoại hết pin) theo tên, email, SĐT hoặc mã vé — rồi cho vào sau khi
 * đối chiếu giấy tờ tuỳ thân. Giống cách Eventbrite Organizer làm ở cửa.
 *
 * Có mạng thì hỏi server (tìm được cả theo email / SĐT đầy đủ, kết quả đã che). Mất mạng thì tìm
 * trong dữ liệu vé trên máy (theo tên không dấu, mã vé, phần email còn lộ), và lượt cho vào được xếp
 * vào hàng đợi đồng bộ như mọi lượt quét offline.
 */
export default function LookupScreen() {
  const params = useLocalSearchParams<{
    eventSessionId?: string;
    organizationId?: string;
    eventTitle?: string;
    gateName?: string;
  }>();
  const eventSessionId = first(params.eventSessionId);
  const organizationId = first(params.organizationId);
  const gate = first(params.gateName);
  const online = useOnline();

  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<CheckinBundleTicket[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchedOffline, setSearchedOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CheckinBundleTicket | null>(null);
  const [checked, setChecked] = useState(false);
  const [admitting, setAdmitting] = useState(false);
  const [result, setResult] = useState<{ response: GateScanResponse; offline: boolean } | null>(null);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2 || !eventSessionId || !organizationId) return;
    let active = true;
    // Chờ người gõ dừng tay: mỗi phím một lời gọi thì kết quả cũ về sau sẽ đè kết quả mới.
    const timer = setTimeout(() => {
      setSearching(true);
      const offlineSearch = () => {
        if (!active) return;
        setRows(searchOffline(eventSessionId, text));
        setSearchedOffline(true);
        setError(hasBundle(eventSessionId) ? null : 'Mất mạng và máy chưa có dữ liệu vé của suất này.');
      };
      if (!online) {
        offlineSearch();
        setSearching(false);
        return;
      }
      lookupTickets(api, organizationId, eventSessionId, text)
        .then((found) => {
          if (!active) return;
          setRows(found);
          setSearchedOffline(false);
          setError(null);
        })
        .catch((cause: unknown) => {
          if (!active) return;
          if (isNetworkFailure(cause)) offlineSearch();
          else if (cause instanceof ApiError && cause.code === 'SHIFT_NOT_ACTIVE') {
            setError('Bạn không còn trong ca của suất này. Quay lại "Ca của tôi".');
          } else setError('Không tìm được lúc này. Thử lại.');
        })
        .finally(() => { if (active) setSearching(false); });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, online, eventSessionId, organizationId]);

  async function admit() {
    if (!selected || !checked) return;
    setAdmitting(true);
    setError(null);
    const here = async () => {
      const response = await scanOffline({
        organizationId,
        sessionId: eventSessionId,
        direction: 'IN',
        ticketId: selected.ticketId,
        gate: gate || null,
      });
      setResult({ response, offline: true });
      vibrateFor(verdictOf(response).tone);
    };
    try {
      if (!online && hasBundle(eventSessionId)) {
        await here();
        return;
      }
      const response = await admitByLookup(api, organizationId, eventSessionId, {
        ticketId: selected.ticketId,
        identityChecked: true,
        deviceId: await deviceId(),
      });
      setResult({ response, offline: false });
      vibrateFor(verdictOf(response).tone);
    } catch (cause) {
      if (isNetworkFailure(cause) && hasBundle(eventSessionId)) {
        await here();
      } else {
        setError(cause instanceof ApiError && cause.detail ? cause.detail : 'Chưa cho vào được. Thử lại.');
        vibrateFor('deny');
      }
    } finally {
      setAdmitting(false);
    }
  }

  function reset() {
    setSelected(null);
    setChecked(false);
    setResult(null);
    setError(null);
  }

  if (selected) {
    const verdict = result ? verdictOf(result.response) : null;
    const tone = verdict ? TONE_COLORS[verdict.tone] : null;
    return (
      <SafeAreaView style={styles.screen}>
        <Header title="Xác nhận cho vào" onBack={reset} />
        <View style={styles.confirm}>
          <TicketSummary ticket={selected} />

          {result && verdict && tone ? (
            <View accessibilityRole="alert" style={[styles.resultPanel, { backgroundColor: tone.background, borderColor: tone.border }]}>
              <View style={styles.verdictRow}>
                <Text style={[styles.verdict, { color: tone.text }]}>{verdict.title}</Text>
                {result.offline ? <Text style={styles.offlineTag}>offline</Text> : null}
              </View>
              <Text style={styles.resultHint}>{result.response.note ?? verdict.hint}</Text>
            </View>
          ) : (
            <>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                onPress={() => setChecked((value) => !value)}
                style={styles.checkRow}>
                <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                  {checked ? <Text style={styles.checkMark}>✓</Text> : null}
                </View>
                <Text style={styles.checkLabel}>Đã đối chiếu giấy tờ tuỳ thân</Text>
              </Pressable>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable
                accessibilityRole="button"
                disabled={!checked || admitting}
                onPress={() => void admit()}
                style={({ pressed }) => [styles.primary, pressed && styles.pressed, (!checked || admitting) && styles.disabled]}>
                {admitting ? <ActivityIndicator color="#17210D" /> : <Text style={styles.primaryText}>CHO VÀO</Text>}
              </Pressable>
            </>
          )}

          <Pressable accessibilityRole="button" onPress={result ? () => router.back() : reset} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
            <Text style={styles.secondaryText}>{result ? 'VỀ MÁY QUÉT' : 'CHỌN KHÁCH KHÁC'}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Header title="Tìm khách" onBack={() => router.back()} />
        <View style={styles.searchBox}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Tên, email, SĐT hoặc mã vé"
            placeholderTextColor="#6F7B72"
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            style={styles.input}
          />
          <Text style={styles.searchHint}>
            {!online || searchedOffline
              ? 'Đang tìm trong dữ liệu trên máy (mất mạng) — theo tên, mã vé.'
              : 'Gõ từ 2 ký tự. Tên tìm được cả khi gõ không dấu.'}
          </Text>
        </View>
        {error ? <Text style={[styles.error, styles.pad]}>{error}</Text> : null}
        {searching ? <ActivityIndicator color="#D5FF66" style={styles.spinner} /> : null}
        <FlatList
          // Dưới 2 ký tự thì không có gì để hiện, kể cả kết quả của lần gõ trước.
          data={query.trim().length >= 2 ? rows : []}
          keyExtractor={(row) => row.ticketId}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            query.trim().length >= 2 && !searching ? <Text style={styles.empty}>Không tìm thấy vé nào khớp.</Text> : undefined
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setSelected(item);
                setChecked(false);
                setResult(null);
              }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <TicketSummary ticket={item} compact />
            </Pressable>
          )}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function TicketSummary({ ticket, compact = false }: { ticket: CheckinBundleTicket; compact?: boolean }) {
  const state = stateOf(ticket);
  return (
    <View style={compact ? undefined : styles.summary}>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>{ticket.holderName ?? 'Khách chưa có tên'}</Text>
        <Text style={[styles.state, { color: state.color }]}>{state.label}</Text>
      </View>
      <Text style={styles.meta}>
        {[ticket.ticketTypeName, seatOf(ticket), `Mã ${ticket.code}`].filter(Boolean).join(' · ')}
      </Text>
      {ticket.emailMasked || ticket.phoneMasked ? (
        <Text style={styles.meta}>{[ticket.emailMasked, ticket.phoneMasked].filter(Boolean).join(' · ')}</Text>
      ) : null}
      {ticket.inside && ticket.lastEntryAt ? (
        <Text style={styles.meta}>
          Vào lúc {formatClock(ticket.lastEntryAt)}
          {ticket.lastEntryGate ? `, ${ticket.lastEntryGate}` : ''}
        </Text>
      ) : null}
    </View>
  );
}

function stateOf(ticket: CheckinBundleTicket): { label: string; color: string } {
  if (ticket.status === 'REVOKED') return { label: 'Đã huỷ', color: '#FF9B84' };
  if (ticket.inside) return { label: 'Đang ở trong', color: '#D5FF66' };
  if (ticket.entryCount > 0) return { label: 'Đã ra', color: '#8CC2FF' };
  return { label: 'Chưa vào', color: '#C1CBC3' };
}

function seatOf(ticket: CheckinBundleTicket): string {
  const seat = ticket.seatLabel ?? ticket.seatCode;
  if (!seat) return ticket.zoneCode ? `Khu ${ticket.zoneCode}` : '';
  return ticket.zoneCode && !seat.includes(ticket.zoneCode) ? `Khu ${ticket.zoneCode} · ${seat}` : seat;
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" onPress={onBack} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
        <Text style={styles.backText}>‹ Quay lại</Text>
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.backSpacer} />
    </View>
  );
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: '#111713' },
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#26312A' },
  back: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 8 },
  backText: { color: '#D5FF66', fontSize: 14, fontWeight: '700' },
  backSpacer: { width: 80 },
  headerTitle: { color: '#F1F5F1', fontSize: 16, fontWeight: '900' },
  searchBox: { padding: 14, gap: 8 },
  input: { minHeight: 52, borderRadius: 8, borderWidth: 1, borderColor: '#3B493F', backgroundColor: '#19221B', paddingHorizontal: 14, color: '#F1F5F1', fontSize: 16 },
  searchHint: { color: '#819087', fontSize: 11 },
  spinner: { marginTop: 10 },
  list: { paddingHorizontal: 14, paddingBottom: 24, gap: 8 },
  row: { padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#344238', backgroundColor: '#19221B' },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  name: { flex: 1, color: '#F1F5F1', fontSize: 16, fontWeight: '800' },
  state: { fontSize: 11, fontWeight: '900' },
  meta: { color: '#A6B1A8', fontSize: 12, marginTop: 4 },
  empty: { color: '#A6B1A8', fontSize: 13, textAlign: 'center', marginTop: 24 },
  error: { color: '#FF8C79', fontSize: 13, lineHeight: 19 },
  pad: { paddingHorizontal: 14 },
  confirm: { padding: 16, gap: 14 },
  summary: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#344238', backgroundColor: '#19221B' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 4 },
  checkbox: { width: 28, height: 28, borderRadius: 6, borderWidth: 2, borderColor: '#3B493F', alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: '#D5FF66', borderColor: '#D5FF66' },
  checkMark: { color: '#17210D', fontSize: 16, fontWeight: '900' },
  checkLabel: { color: '#F1F5F1', fontSize: 15, fontWeight: '700' },
  primary: { minHeight: 56, borderRadius: 8, backgroundColor: '#D5FF66', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#17210D', fontSize: 14, fontWeight: '900', letterSpacing: 0.8 },
  secondary: { minHeight: 48, borderRadius: 8, borderWidth: 1, borderColor: '#3B493F', alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#D5FF66', fontSize: 12, fontWeight: '900', letterSpacing: 0.6 },
  resultPanel: { padding: 16, borderRadius: 10, borderWidth: 2 },
  verdictRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  verdict: { fontSize: 24, fontWeight: '900' },
  offlineTag: { color: '#2C2416', backgroundColor: '#FFC773', fontSize: 10, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  resultHint: { color: '#C1CBC3', fontSize: 13, lineHeight: 19, marginTop: 8 },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
});
