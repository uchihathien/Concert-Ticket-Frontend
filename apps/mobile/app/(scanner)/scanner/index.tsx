import { ApiError, startShift } from '@nexaticket/ts-sdk';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SessionPicker } from '@/components/SessionPicker';
import { SwitchRoleButton } from '@/components/SwitchRoleButton';
import { api } from '@/lib/api';
import { useMobileAuth } from '@/lib/auth-context';
import { deviceId, downloadBundle, purgeExpired } from '@/lib/offline/store';
import { formatClock, formatSessionDate } from '@/lib/scan-verdicts';
import { loadMyShifts, shiftScanParams, type MyShiftItem, type MyShiftsContext } from '@/lib/scanner-sessions';

/**
 * "Ca của tôi" — màn đầu tiên của nhân viên soát vé sau khi đăng nhập.
 *
 * Nhân viên chỉ có vai soát vé chỉ quét được trong ca đã bắt đầu, nên việc đầu tiên là chọn ca và
 * bấm BẮT ĐẦU CA; cổng lấy theo ca. Người quản lý sự kiện không bị ràng buộc ca: họ có thêm khối
 * "Soát không theo ca" để mở bất kỳ suất nào. Tài khoản chưa có tổ chức nào (lời mời đang chờ) thấy
 * khối nhận lời mời ở cùng chỗ đó.
 */
export default function MyShiftsScreen() {
  const { signOut } = useMobileAuth();
  const { pick } = useLocalSearchParams<{ pick?: string }>();
  const [context, setContext] = useState<MyShiftsContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);

  const load = useCallback(() => {
    // Dữ liệu vé của ca đã kết thúc quá 6 giờ không còn lý do ở lại trên máy.
    purgeExpired();
    return loadMyShifts()
      .then((value) => {
        setContext(value);
        setError(null);
      })
      .catch((cause: unknown) => {
        setError(
          cause instanceof ApiError && cause.status === 401
            ? 'Phiên đăng nhập đã hết hạn. Đăng nhập lại.'
            : 'Không tải được ca trực. Kiểm tra kết nối rồi kéo xuống để thử lại.',
        );
      });
  }, []);

  // Tải lại mỗi lần quay về màn này (vd sau khi kết thúc ca): trạng thái ca vừa đổi.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function begin(shift: MyShiftItem) {
    setStartingId(shift.id);
    setError(null);
    try {
      if (!shift.myStartedAt) await startShift(api, shift.organizationId, shift.id, await deviceId());
      // Tải dữ liệu vé ngay lúc bắt đầu ca, khi chắc chắn còn mạng.
      await downloadBundle(shift.organizationId, shift.eventSessionId, shift.endsAt).catch(() => undefined);
      router.push({ pathname: '/scanner/scan', params: shiftScanParams(shift) });
    } catch (cause) {
      setError(cause instanceof ApiError && cause.detail ? cause.detail : 'Chưa bắt đầu được ca. Thử lại.');
      void load();
    } finally {
      setStartingId(null);
    }
  }

  const today = context?.shifts ?? [];
  const showPicker = Boolean(pick) || (context !== null && (context.manager || !context.hasScannerOrganization));

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topline}>
        <View>
          <Text style={styles.brand}>NEXATICKET STAFF</Text>
          <View style={styles.status}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>CA CỦA TÔI</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <SwitchRoleButton />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đăng xuất nhân viên"
            onPress={() => void signOut()}
            style={({ pressed }) => [styles.signOut, pressed && styles.signOutPressed]}>
            <Text style={styles.signOutText}>Đăng xuất</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor="#D5FF66"
            onRefresh={() => {
              setRefreshing(true);
              void load().finally(() => setRefreshing(false));
            }}
          />
        }>
        <Text style={styles.title}>Ca của tôi</Text>
        <Text style={styles.subtitle}>Ca hôm nay và sắp tới. Bắt đầu ca để mở máy quét — cổng lấy theo ca.</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {context === null && !error ? (
          <View style={styles.loading}><ActivityIndicator color="#D5FF66" size="large" /></View>
        ) : null}

        {context !== null && today.length === 0 && context.hasScannerOrganization && !context.manager ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Hôm nay bạn chưa có ca trực.</Text>
            <Text style={styles.emptyCopy}>Liên hệ ban tổ chức để được xếp ca.</Text>
          </View>
        ) : null}

        {today.map((shift) => (
          <ShiftCard key={shift.id} shift={shift} busy={startingId === shift.id} onStart={() => void begin(shift)} />
        ))}

        {showPicker ? (
          <View style={styles.picker}>
            <Text style={styles.kicker}>{context?.hasScannerOrganization ? 'SOÁT KHÔNG THEO CA' : 'LỜI MỜI'}</Text>
            <Text style={styles.pickerCopy}>
              {context?.hasScannerOrganization
                ? 'Bạn quản lý sự kiện nên soát được mọi suất mà không cần ca.'
                : 'Tài khoản chưa thuộc tổ chức nào. Chấp nhận lời mời để bắt đầu.'}
            </Text>
            <SessionPicker />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ShiftCard({ shift, busy, onStart }: { shift: MyShiftItem; busy: boolean; onStart: () => void }) {
  const started = Boolean(shift.myStartedAt);
  const ended = shift.state === 'ENDED';
  const label = started ? 'TIẾP TỤC CA' : 'BẮT ĐẦU CA';
  return (
    <View style={[styles.card, started && styles.cardActive]}>
      <Text style={styles.cardOrg}>{shift.organizationName.toUpperCase()}</Text>
      <Text style={styles.cardTitle}>{shift.eventTitle ?? 'Sự kiện'}</Text>
      {shift.sessionStartsAt ? <Text style={styles.cardMeta}>Suất {formatSessionDate(shift.sessionStartsAt)}</Text> : null}
      <View style={styles.cardRow}>
        <View style={styles.cardCell}>
          <Text style={styles.cellLabel}>CỔNG</Text>
          <Text style={styles.cellValue}>{shift.gateName}</Text>
        </View>
        <View style={styles.cardCell}>
          <Text style={styles.cellLabel}>GIỜ CA</Text>
          <Text style={styles.cellValue}>{formatClock(shift.startsAt)} – {formatClock(shift.endsAt)}</Text>
        </View>
      </View>
      {started ? <Text style={styles.onDuty}>Đang trực từ {formatClock(shift.myStartedAt)}</Text> : null}
      {ended && !started ? (
        <Text style={styles.cardMeta}>Ca đã kết thúc.</Text>
      ) : !shift.canStart && !started ? (
        <Text style={styles.cardMeta}>Bắt đầu được từ 30 phút trước giờ ca.</Text>
      ) : (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onStart}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed, busy && styles.disabled]}>
          {busy ? <ActivityIndicator color="#17210D" /> : <Text style={styles.primaryText}>{label}</Text>}
          <Text style={styles.arrow}>›</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111713' },
  scrollView: { flex: 1 },
  topline: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, borderBottomWidth: 1, borderBottomColor: '#26312A' },
  brand: { color: '#E6EEE8', fontSize: 12, fontWeight: '900', letterSpacing: 1.4 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#D5FF66' },
  statusText: { color: '#A8B4AA', fontSize: 10, fontWeight: '800' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  signOut: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 7, borderWidth: 1, borderColor: '#3B493F' },
  signOutPressed: { borderColor: '#B8624C', backgroundColor: '#2A201D' },
  signOutText: { color: '#A6B1A8', fontSize: 13, fontWeight: '700' },
  content: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 32, gap: 14 },
  title: { color: '#F1F5F1', fontSize: 34, lineHeight: 40, fontWeight: '900' },
  subtitle: { color: '#A6B1A8', fontSize: 14, lineHeight: 21 },
  loading: { paddingVertical: 40, alignItems: 'center' },
  error: { color: '#FF8C79', fontSize: 13, lineHeight: 19 },
  empty: { padding: 18, borderRadius: 10, borderWidth: 1, borderColor: '#344238', backgroundColor: '#19221B' },
  emptyTitle: { color: '#F1F5F1', fontSize: 16, fontWeight: '800' },
  emptyCopy: { color: '#A6B1A8', fontSize: 13, marginTop: 6 },
  card: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#344238', backgroundColor: '#19221B', gap: 6 },
  cardActive: { borderColor: '#77B44A', backgroundColor: '#1D2B1E' },
  cardOrg: { color: '#95A298', fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  cardTitle: { color: '#F1F5F1', fontSize: 18, fontWeight: '900' },
  cardMeta: { color: '#A6B1A8', fontSize: 13 },
  cardRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  cardCell: { flex: 1, borderRadius: 8, backgroundColor: '#151D17', padding: 10 },
  cellLabel: { color: '#95A298', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  cellValue: { color: '#F1F5F1', fontSize: 16, fontWeight: '900', marginTop: 3 },
  onDuty: { color: '#D5FF66', fontSize: 13, fontWeight: '700', marginTop: 4 },
  primary: { minHeight: 54, marginTop: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#D5FF66', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  primaryText: { color: '#17210D', fontSize: 13, fontWeight: '900', letterSpacing: 0.8 },
  arrow: { color: '#17210D', fontSize: 22, fontWeight: '700' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.55 },
  picker: { marginTop: 12, gap: 8 },
  kicker: { color: '#D5FF66', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  pickerCopy: { color: '#A6B1A8', fontSize: 13, lineHeight: 19 },
});
