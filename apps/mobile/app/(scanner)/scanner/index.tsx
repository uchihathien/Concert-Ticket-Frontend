import { ApiError } from '@nexaticket/ts-sdk';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SessionPicker } from '@/components/SessionPicker';
import { SwitchRoleButton } from '@/components/SwitchRoleButton';
import { useMobileAuth } from '@/lib/auth-context';
import { purgeExpired } from '@/lib/offline/store';
import { formatClock, formatSessionDate } from '@/lib/scan-verdicts';
import {
  loadScannerContext,
  scanParams,
  type ScannerAssignment,
  type ScannerContext,
  type ScannerSession,
} from '@/lib/scanner-sessions';

/**
 * "Sự kiện được gán" — màn đầu tiên của Staff sau khi đăng nhập.
 *
 * Staff đăng nhập bằng chính tài khoản NexaTicket của mình; ban tổ chức thêm họ vào tổ chức với vai
 * Staff rồi gán sự kiện (hoặc từng suất) gần ngày diễn. Màn này liệt kê đúng những phân công còn
 * hiệu lực — sắp tới và đang diễn ra — và chỉ mở máy quét cho các suất trong đó. Phân công tự hết
 * hạn 6 giờ sau khi suất cuối kết thúc nên không còn hiện ở đây.
 *
 * Người quản lý sự kiện không bị giới hạn theo phân công: họ thấy khối "Soát mọi suất" để mở bất kỳ
 * suất nào của tổ chức.
 */
export default function AssignedEventsScreen() {
  const { signOut } = useMobileAuth();
  const { pick } = useLocalSearchParams<{ pick?: string }>();
  const [context, setContext] = useState<ScannerContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    // Dữ liệu vé của suất đã kết thúc quá 6 giờ không còn lý do ở lại trên máy.
    purgeExpired();
    return loadScannerContext()
      .then((value) => {
        setContext(value);
        setError(null);
      })
      .catch((cause: unknown) => {
        setError(
          cause instanceof ApiError && cause.status === 401
            ? 'Phiên đăng nhập đã hết hạn. Đăng nhập lại.'
            : 'Không tải được sự kiện được gán. Kiểm tra kết nối rồi kéo xuống để thử lại.',
        );
      });
  }, []);

  // Tải lại mỗi lần quay về màn này: ban tổ chức có thể vừa gán thêm hoặc gỡ bớt.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const manager = context !== null && !context.assignedOnly && context.organizations.length > 0;
  const assignments = context?.assignments ?? [];
  const showPicker = Boolean(pick) || manager || (context !== null && context.organizations.length === 0);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topline}>
        <View>
          <Text style={styles.brand}>NEXATICKET STAFF</Text>
          <View style={styles.status}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>SỰ KIỆN ĐƯỢC GÁN</Text>
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
        <Text style={styles.title}>Sự kiện được gán</Text>
        <Text style={styles.subtitle}>Sự kiện sắp tới và đang diễn ra mà ban tổ chức giao cho bạn soát vé.</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {context === null && !error ? (
          <View style={styles.loading}><ActivityIndicator color="#D5FF66" size="large" /></View>
        ) : null}

        {context !== null && context.assignedOnly && assignments.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Bạn chưa được gán sự kiện nào.</Text>
            <Text style={styles.emptyCopy}>Liên hệ ban tổ chức.</Text>
          </View>
        ) : null}

        {context !== null
          ? assignments.map((assignment) => (
              <AssignmentCard
                key={`${assignment.organizationId}:${assignment.eventId}:${assignment.eventSessionId ?? 'all'}`}
                assignment={assignment}
                sessions={context.sessions}
              />
            ))
          : null}

        {showPicker ? (
          <View style={styles.picker}>
            <Text style={styles.kicker}>{context?.organizations.length ? 'SOÁT MỌI SUẤT' : 'CHƯA THUỘC TỔ CHỨC NÀO'}</Text>
            <Text style={styles.pickerCopy}>
              {context?.organizations.length
                ? 'Bạn quản lý sự kiện nên soát được mọi suất của tổ chức mà không cần được gán.'
                : 'Tài khoản chưa được thêm vào tổ chức nào. Nhờ ban tổ chức thêm bạn với vai Staff.'}
            </Text>
            <SessionPicker />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const STATUS_TEXT: Record<string, string> = {
  ONGOING: 'ĐANG DIỄN RA',
  UPCOMING: 'SẮP TỚI',
  UNKNOWN: 'CHƯA RÕ LỊCH',
};

/**
 * Một phân công: sự kiện, trạng thái, và nút mở máy quét cho từng suất trong phạm vi được gán.
 *
 * Chỉ suất còn trong danh sách soát của backend (`sessions`, đã bỏ suất đã kết thúc) mới có nút —
 * suất trong phạm vi nhưng đã xong thì chỉ hiện giờ, không mời bấm vào một suất sẽ bị từ chối.
 */
function AssignmentCard({ assignment, sessions }: { assignment: ScannerAssignment; sessions: ScannerSession[] }) {
  const ongoing = assignment.status === 'ONGOING';
  const open = new Map(
    sessions
      .filter((session) => session.organizationId === assignment.organizationId)
      .map((session) => [session.eventSessionId, session]),
  );
  return (
    <View style={[styles.card, ongoing && styles.cardActive]}>
      <Text style={styles.cardOrg}>{assignment.organizationName.toUpperCase()}</Text>
      <Text style={styles.cardTitle}>{assignment.eventTitle ?? 'Sự kiện'}</Text>
      {assignment.venueName ? <Text style={styles.cardMeta}>{assignment.venueName}</Text> : null}
      <Text style={[styles.cardStatus, ongoing && styles.cardStatusActive]}>
        {STATUS_TEXT[assignment.status] ?? assignment.status}
        {assignment.eventSessionId ? '' : ' · CẢ SỰ KIỆN'}
      </Text>
      {assignment.sessions.map((item) => {
        const session = open.get(item.eventSessionId);
        return session ? (
          <Pressable
            key={item.eventSessionId}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/scanner/scan', params: scanParams(session) })}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
            <Text style={styles.primaryText}>Suất {formatSessionDate(item.startsAt)}</Text>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        ) : (
          <Text key={item.eventSessionId} style={styles.cardMeta}>
            Suất {formatSessionDate(item.startsAt)} · đã kết thúc {item.endsAt ? formatClock(item.endsAt) : ''}
          </Text>
        );
      })}
      {assignment.expiresAt ? (
        <Text style={styles.cardMeta}>Phân công hết hiệu lực lúc {formatClock(assignment.expiresAt)} {formatSessionDate(assignment.expiresAt)}</Text>
      ) : null}
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
  cardStatus: { color: '#A6B1A8', fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginTop: 2 },
  cardStatusActive: { color: '#D5FF66' },
  primary: { minHeight: 52, marginTop: 6, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#D5FF66', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  primaryText: { color: '#17210D', fontSize: 15, fontWeight: '700' },
  arrow: { color: '#17210D', fontSize: 22, fontWeight: '700' },
  pressed: { opacity: 0.8 },
  picker: { marginTop: 12, gap: 8 },
  kicker: { color: '#D5FF66', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  pickerCopy: { color: '#A6B1A8', fontSize: 13, lineHeight: 19 },
});
