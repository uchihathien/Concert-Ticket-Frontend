import {
  ApiError,
  getInventoryStock,
  getMyOrganizations,
  getMyPermissions,
  getSalesBreakdown,
  getSalesSummary,
  listEvents,
  searchOrganizationTickets,
  unpublishEvent,
  publishEvent,
  type AdminEventRow,
  type EventStatus,
  type InventoryStock,
  type OrganizationSummary,
  type OrganizationTicketPage,
  type SalesBreakdown,
  type SalesSummary,
} from '@nexaticket/ts-sdk';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LoginButton } from '@/components/LoginButton';
import { SwitchRoleButton } from '@/components/SwitchRoleButton';
import { RevenueBarChart, type EventRevenue } from '@/components/RevenueBarChart';
import { api } from '@/lib/api';
import { useMobileAuth } from '@/lib/auth-context';

/*
 * App tổ chức trên điện thoại chỉ giữ việc vận hành: xem doanh thu, mở/tạm dừng bán, tra vé tại cổng
 * và chuyển sang soát vé. Tạo và cấu hình sự kiện, địa điểm, sơ đồ ghế, thành viên làm trên web.
 */
type OrganizerTab = 'overview' | 'events' | 'tickets';
const TABS: { key: OrganizerTab; label: string; title: string }[] = [
  { key: 'overview', label: 'Tổng quan', title: 'Tổng quan' },
  { key: 'events', label: 'Sự kiện', title: 'Sự kiện' },
  { key: 'tickets', label: 'Vé', title: 'Tra cứu vé' },
];

export default function OrganizerHome() {
  const { ready, signedIn, signOut, roles, chooseRole } = useMobileAuth();
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [tab, setTab] = useState<OrganizerTab>('overview');
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !signedIn) return;
    let active = true;
    Promise.all([getMyOrganizations(api), getMyPermissions(api)])
      .then(([items, permissions]) => {
        const manageable = items.filter((item) => permissions.organizations[item.id]?.includes('CATALOG_MANAGE'));
        if (!active) return;
        setOrganizations(manageable);
        setOrganizationId((current) => current && manageable.some((item) => item.id === current) ? current : manageable[0]?.id ?? null);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof ApiError && cause.status === 403 ? 'Tài khoản không có quyền quản lý tổ chức.' : 'Không tải được tổ chức của bạn.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ready, signedIn]);

  // `loading` chỉ có nghĩa khi đã đăng nhập: effect tải tổ chức không chạy khi chưa đăng nhập, nên
  // chờ nó ở trạng thái đó là quay vòng mãi và không bao giờ tới màn đăng nhập.
  if (!ready || (signedIn && loading)) return <SafeAreaView style={styles.screen}><View style={styles.center}><ActivityIndicator color="#D5FF66" /></View></SafeAreaView>;
  if (!signedIn) return <SafeAreaView style={styles.screen}><View style={styles.login}><Text style={styles.brand}>NEXATICKET / ORGANIZER</Text><Text style={styles.title}>Quản lý sự kiện</Text><Text style={styles.muted}>Đăng nhập bằng tài khoản thành viên tổ chức.</Text><LoginButton /></View></SafeAreaView>;

  const organization = organizations.find((item) => item.id === organizationId) ?? null;
  const canScan = roles.includes('scanner');

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <View><Text style={styles.brand}>NEXATICKET / ORGANIZER</Text><Text style={styles.headerTitle}>{TABS.find((item) => item.key === tab)?.title}</Text></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><SwitchRoleButton /><Pressable accessibilityRole="button" onPress={() => { setLoading(true); void signOut(); }}><Text style={styles.signOut}>Đăng xuất</Text></Pressable></View>
      </View>
      {organizations.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.orgScroll} contentContainerStyle={styles.orgList}>
          {organizations.map((item) => (
            <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: item.id === organizationId }} onPress={() => setOrganizationId(item.id)} style={[styles.orgChip, item.id === organizationId && styles.orgChipSelected]}>
              <Text style={[styles.orgChipText, item.id === organizationId && styles.orgChipTextSelected]}>{item.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.body}>
        {error ? <StateCard title="Không tải được dữ liệu" detail={error} /> : !organization ? <StateCard title="Chưa có tổ chức được cấp quyền" detail="Tài khoản cần quyền CATALOG_MANAGE để sử dụng app tổ chức." /> : (
          <>
            {tab === 'overview' ? <OverviewScreen organizationId={organization.id} /> : null}
            {tab === 'events' ? <EventsScreen organizationId={organization.id} /> : null}
            {tab === 'tickets' ? <TicketsScreen organizationId={organization.id} /> : null}
          </>
        )}
      </View>

      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 6) }]} accessibilityRole="tablist">
        {TABS.map((item) => (
          <TabButton key={item.key} label={item.label} selected={tab === item.key} onPress={() => setTab(item.key)} />
        ))}
        {/* Soát vé là một vai khác của app, không phải một tab ở đây: bấm là chuyển vai. */}
        {canScan ? <TabButton label="Soát vé" selected={false} onPress={() => void chooseRole('scanner')} /> : null}
      </View>
    </SafeAreaView>
  );
}

/*
 * Khoảng thời gian giống bộ lọc của web admin (`apps/web-admin/src/lib/stats-filters.ts`): mặc định
 * 30 ngày, "toàn thời gian" là trần 731 ngày của server, và so sánh kỳ trước tắt với toàn thời gian.
 */
type StatsRange = 'today' | '7d' | '30d' | 'all';
const RANGES: { key: StatsRange; label: string }[] = [
  { key: 'today', label: 'Hôm nay' },
  { key: '7d', label: '7 ngày' },
  { key: '30d', label: '30 ngày' },
  { key: 'all', label: 'Toàn thời gian' },
];
const ALL_TIME_DAYS = 731;

/**
 * "Hôm nay" theo giờ Việt Nam, không theo múi giờ của máy. Việt Nam cố định UTC+7, không đổi giờ mùa
 * hè, nên cộng 7 tiếng là đủ — không phụ thuộc dữ liệu múi giờ của Intl trên Hermes.
 */
function todayInVietnam(): string {
  return new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function resolveRange(range: StatsRange) {
  const to = todayInVietnam();
  const from = range === '7d' ? addDays(to, -6) : range === '30d' ? addDays(to, -29) : range === 'all' ? addDays(to, -(ALL_TIME_DAYS - 1)) : to;
  return { params: { from, to }, compare: range !== 'all' };
}

interface OverviewData {
  summary: SalesSummary;
  breakdown: SalesBreakdown | null;
  stock: InventoryStock | null;
  titles: Record<string, string>;
}

function OverviewScreen({ organizationId }: { organizationId: string }) {
  const [range, setRange] = useState<StatsRange>('30d');
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const { params, compare } = resolveRange(range);
    setLoading(true);
    setError(null);
    // Tổng kỳ là số chính, thiếu thì báo lỗi. Bảng theo suất, tồn kho và tên sự kiện là phụ: không tải
    // được thì vẫn hiện số tổng, chỉ thiếu phần đó.
    Promise.all([
      getSalesSummary(api, organizationId, params, compare),
      getSalesBreakdown(api, organizationId, params).catch(() => null),
      getInventoryStock(api, organizationId).catch(() => null),
      listEvents(api, organizationId).catch(() => [] as AdminEventRow[]),
    ])
      .then(([summary, breakdown, stock, events]) => {
        if (active) setData({ summary, breakdown, stock, titles: Object.fromEntries(events.map((event) => [event.id, event.title])) });
      })
      .catch(() => { if (active) setError('Không tải được doanh thu.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [organizationId, range]);

  const titleOf = (eventId: string) => data?.titles[eventId] ?? `Sự kiện ${eventId.slice(0, 8)}`;

  const byEvent = useMemo<EventRevenue[]>(() => {
    if (!data?.breakdown) return [];
    const groups = new Map<string, EventRevenue>();
    for (const row of data.breakdown.sessions) {
      const current = groups.get(row.eventId) ?? {
        eventId: row.eventId,
        title: data.titles[row.eventId] ?? `Sự kiện ${row.eventId.slice(0, 8)}`,
        grossVnd: 0, ticketsSold: 0, ordersPaid: 0, ordersExpired: 0, ordersCancelled: 0, sessionCount: 0,
      };
      current.grossVnd += row.grossVnd;
      current.ticketsSold += row.ticketsSold;
      current.ordersPaid += row.ordersPaid;
      current.ordersExpired += row.ordersExpired;
      current.ordersCancelled += row.ordersCancelled;
      current.sessionCount += 1;
      groups.set(row.eventId, current);
    }
    return [...groups.values()];
  }, [data]);

  const chips = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.orgScroll} contentContainerStyle={styles.choiceList}>
      {RANGES.map((item) => <Choice key={item.key} label={item.label} selected={item.key === range} onPress={() => setRange(item.key)} />)}
    </ScrollView>
  );

  if (error) return <ScrollView contentContainerStyle={styles.screenContent}>{chips}<StateCard title="Doanh thu chưa khả dụng" detail={error} /></ScrollView>;
  if (!data) return <LoadingState />;

  const { current, previous, period } = data.summary;
  const change = deltaText(current.grossVnd, previous?.grossVnd);
  // Lấp đầy là số "hiện tại", không theo khoảng đang chọn — cùng định nghĩa với web.
  const capacity = data.stock ? data.stock.ticketTypes.reduce((sum, row) => sum + row.capacity - row.blocked, 0) : 0;
  const sold = data.stock ? data.stock.ticketTypes.reduce((sum, row) => sum + row.sold, 0) : 0;
  const occupancy = capacity > 0 ? `${Math.round((sold / capacity) * 100)}%` : '—';
  const sessionsSorted = [...(data.breakdown?.sessions ?? [])].sort((a, b) => b.grossVnd - a.grossVnd);

  return (
    <ScrollView contentContainerStyle={[styles.screenContent, loading && styles.disabled]}>
      {chips}
      <Text style={styles.muted}>{formatDay(period.from)} – {formatDay(period.to)} · đơn tính theo thời điểm đặt.</Text>
      {current.ordersTotal === 0 ? <Text style={styles.muted}>Chưa có đơn hàng nào trong khoảng thời gian này.</Text> : null}

      {/* Con số chính đứng một mình, to nhất; các số phụ xếp bên dưới. */}
      <View style={[styles.stat, styles.full]}>
        <Text style={styles.muted}>Doanh thu</Text>
        <Text style={styles.heroValue}>{money(current.grossVnd)}</Text>
        {change ? <Text style={[styles.delta, change.tone === 'up' && styles.deltaUp, change.tone === 'down' && styles.error]}>{change.text}</Text> : null}
      </View>
      <View style={styles.kpiRow}>
        <View style={[styles.stat, styles.kpi]}><Text style={styles.statValue}>{number(current.ticketsSold)}</Text><Text style={styles.muted}>Vé đã bán</Text></View>
        <View style={[styles.stat, styles.kpi]}><Text style={styles.statValue}>{number(current.ordersPaid)}</Text><Text style={styles.muted}>Đơn đã thanh toán</Text></View>
      </View>
      <View style={[styles.stat, styles.full]}>
        <Text style={styles.statValue}>{occupancy}</Text>
        <Text style={styles.muted}>Lấp đầy · {data.stock ? `${number(sold)}/${number(capacity)} chỗ, tính ở hiện tại` : 'chưa tải được tồn kho'}</Text>
      </View>

      <Section title="Doanh thu theo sự kiện">
        {data.breakdown ? <RevenueBarChart rows={byEvent} formatMoney={money} /> : <Text style={styles.muted}>Chưa tải được số liệu theo sự kiện.</Text>}
      </Section>

      {/* Bảng số liệu đầy đủ — mọi suất, kể cả suất chưa có doanh thu mà biểu đồ không vẽ. */}
      <Section title="Theo suất diễn">
        {sessionsSorted.length === 0 ? <Text style={styles.muted}>Chưa có suất nào phát sinh đơn trong khoảng này.</Text> : sessionsSorted.map((row) => (
          <View key={row.eventSessionId} style={styles.listItem}>
            <Text style={styles.cardTitle}>{titleOf(row.eventId)}</Text>
            <Text style={styles.muted}>{money(row.grossVnd)} · {number(row.ticketsSold)} vé · {row.ordersPaid} đơn đã trả · {row.ordersExpired} hết hạn · {row.ordersCancelled} huỷ</Text>
          </View>
        ))}
      </Section>
    </ScrollView>
  );
}

const STATUS_LABEL: Record<EventStatus, string> = {
  DRAFT: 'Nháp',
  PUBLISHED: 'Đang bán',
  UNPUBLISHED: 'Tạm dừng',
  CANCELLED: 'Đã huỷ',
};

function EventsScreen({ organizationId }: { organizationId: string }) {
  const [events, setEvents] = useState<AdminEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    listEvents(api, organizationId)
      .then((rows) => { if (active) setEvents(rows); })
      .catch(() => { if (active) setMessage('Không tải được danh sách sự kiện.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [organizationId, reload]);

  function confirmToggle(event: AdminEventRow) {
    const publishing = event.status !== 'PUBLISHED';
    Alert.alert(
      publishing ? 'Mở bán sự kiện' : 'Tạm dừng bán',
      publishing ? `Mở bán "${event.title}"? Khách sẽ thấy và mua được vé.` : `Tạm dừng bán "${event.title}"? Khách sẽ không mua thêm được vé.`,
      [
        { text: 'Huỷ', style: 'cancel' },
        { text: publishing ? 'Mở bán' : 'Tạm dừng', style: publishing ? 'default' : 'destructive', onPress: () => void toggle(event, publishing) },
      ],
    );
  }

  async function toggle(event: AdminEventRow, publishing: boolean) {
    setBusy(true); setMessage(null);
    try {
      if (publishing) await publishEvent(api, organizationId, event.id);
      else await unpublishEvent(api, organizationId, event.id);
      setReload((value) => value + 1);
    } catch (cause) { setMessage(cause instanceof ApiError ? cause.detail ?? 'Không đổi được trạng thái.' : 'Không đổi được trạng thái.'); }
    finally { setBusy(false); }
  }

  if (loading) return <LoadingState />;
  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <Text style={styles.muted}>Tạo và cấu hình sự kiện trên trang web quản trị.</Text>
      {message ? <Text style={styles.warning}>{message}</Text> : null}
      <Section title={`Danh sách sự kiện (${events.length})`}>
        {events.map((event) => <View key={event.id} style={styles.listItem}>
          <EventRow event={event} />
          {event.status !== 'CANCELLED' ? <ActionButton label={event.status === 'PUBLISHED' ? 'TẠM DỪNG BÁN' : 'MỞ BÁN'} onPress={() => confirmToggle(event)} disabled={busy} secondary /> : null}
        </View>)}
        {events.length === 0 ? <Text style={styles.muted}>Chưa có sự kiện.</Text> : null}
      </Section>
    </ScrollView>
  );
}

function TicketsScreen({ organizationId }: { organizationId: string }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState<OrganizationTicketPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('Nhập tên khách, mã vé hoặc mã ghế để tra cứu.');
  async function search() {
    if (!query.trim()) { setMessage('Nhập nội dung cần tra.'); return; }
    setLoading(true); setMessage('');
    try { setPage(await searchOrganizationTickets(api, organizationId, { query: query.trim(), page: 0, size: 50 })); }
    catch { setMessage('Không tra cứu được vé. Kiểm tra quyền tổ chức.'); }
    finally { setLoading(false); }
  }
  return <ScrollView contentContainerStyle={styles.screenContent}><Section title="Tra cứu vé"><Field label="Tên khách, mã vé hoặc mã ghế" value={query} onChangeText={setQuery} /><ActionButton label={loading ? 'ĐANG TÌM...' : 'TÌM VÉ'} onPress={() => void search()} disabled={loading} />{message ? <Text style={styles.muted}>{message}</Text> : null}</Section>{page ? <Section title={`${page.total} vé phù hợp`}>{page.rows.map((ticket) => <View key={ticket.ticketId} style={styles.listItem}><Text style={styles.cardTitle}>{ticket.holderName ?? 'Khách chưa có tên'}</Text><Text style={styles.muted}>{ticket.ticketTypeName} · {ticket.seatLabel ?? ticket.zoneCode}</Text><Text style={styles.muted}>{ticket.paymentStatus} · {ticket.status}</Text></View>)}</Section> : null}</ScrollView>;
}

function EventRow({ event }: { event: AdminEventRow }) { return <View style={styles.eventRow}><View style={styles.rowText}><Text style={styles.cardTitle}>{event.title}</Text><Text style={styles.muted}>{event.venueName ?? 'Chưa có địa điểm'}</Text><Text style={styles.muted}>{event.nextSessionAt ? `Suất gần nhất: ${formatDateTime(event.nextSessionAt)}` : 'Chưa có suất sắp diễn'}</Text></View><Text style={styles.badge}>{STATUS_LABEL[event.status] ?? event.status}</Text></View>; }
function Section({ title, children }: { title: string; children: ReactNode }) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>; }
function StateCard({ title, detail }: { title: string; detail: string }) { return <View style={styles.state}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.muted}>{detail}</Text></View>; }
function LoadingState() { return <View style={styles.center}><ActivityIndicator color="#D5FF66" /></View>; }
function Field(props: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; keyboardType?: 'default' | 'email-address' | 'numeric'; autoCapitalize?: 'none' | 'sentences' }) { return <View style={styles.field}><Text style={styles.fieldLabel}>{props.label}</Text><TextInput {...props} placeholder={props.placeholder} placeholderTextColor="#77847A" style={styles.input} autoCapitalize={props.autoCapitalize ?? 'sentences'} /></View>; }
function ActionButton({ label, onPress, disabled, secondary }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) { return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.actionButton, secondary && styles.actionSecondary, disabled && styles.disabled, pressed && styles.pressed]}><Text style={[styles.actionText, secondary && styles.actionTextAlt]}>{label}</Text></Pressable>; }
function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.choice, selected && styles.choiceSelected]}><Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text></Pressable>; }
/** Giống `formatMoney` của web admin: `1.234.000 ₫`. */
function money(value: number) { return `${number(Math.round(value))} ₫`; }
function number(value: number) { return new Intl.NumberFormat('vi-VN').format(value); }
function formatDay(date: string) { const [year, month, day] = date.split('-'); return `${day}/${month}/${year}`; }
function formatDateTime(value: string) { return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }

/** % so với kỳ trước, như `delta` của web: kỳ trước bằng 0 thì không chia được, chỉ nói là tăng từ 0. */
function deltaText(current: number, previous: number | null | undefined): { text: string; tone: 'up' | 'down' | 'flat' } | null {
  if (previous === null || previous === undefined) return null;
  if (previous === 0) return current > 0 ? { text: 'Tăng từ 0 so với kỳ trước', tone: 'up' } : { text: 'Không đổi so với kỳ trước', tone: 'flat' };
  const percent = (current - previous) / previous;
  if (Math.abs(percent) < 0.0005) return { text: 'Không đổi so với kỳ trước', tone: 'flat' };
  const value = Math.abs(percent * 100).toLocaleString('vi-VN', { maximumFractionDigits: 0 });
  return percent > 0 ? { text: `▲ ${value}% so với kỳ trước`, tone: 'up' } : { text: `▼ ${value}% so với kỳ trước`, tone: 'down' };
}

function TabButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.tabButton, pressed && styles.tabPressed]}
    >
      <View style={[styles.tabIndicator, selected && styles.tabIndicatorSelected]} />
      <Text numberOfLines={1} style={[styles.tabText, selected && styles.tabTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111713' }, header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#28342B' },
  brand: { color: '#D5FF66', fontSize: 11, fontWeight: '900', letterSpacing: 1.3 }, headerTitle: { color: '#F1F5F1', fontSize: 20, fontWeight: '900', marginTop: 4 }, signOut: { color: '#A6B1A8', fontSize: 13 },
  orgList: { paddingHorizontal: 16, paddingVertical: 10, gap: 7 }, orgChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 7, borderWidth: 1, borderColor: '#3B493F' }, orgChipSelected: { backgroundColor: '#D5FF66', borderColor: '#D5FF66' }, orgChipText: { color: '#CAD3CB', fontSize: 13, fontWeight: '700' }, orgChipTextSelected: { color: '#17210D' },
  body: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, login: { flex: 1, justifyContent: 'center', padding: 24, gap: 14 },
  title: { color: '#F1F5F1', fontSize: 27, fontWeight: '900' }, stat: { width: '48%', minHeight: 82, justifyContent: 'center', padding: 13, borderRadius: 8, backgroundColor: '#1B241D', borderWidth: 1, borderColor: '#344238' }, statValue: { color: '#D5FF66', fontSize: 22, fontWeight: '900' },
  section: { padding: 14, gap: 10, borderRadius: 8, borderWidth: 1, borderColor: '#344238', backgroundColor: '#19221B' }, sectionTitle: { color: '#F1F5F1', fontSize: 17, fontWeight: '800' }, eventRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, rowText: { flex: 1 }, cardTitle: { color: '#F1F5F1', fontSize: 15, fontWeight: '800' }, badge: { color: '#D5FF66', fontSize: 10, fontWeight: '900' },
  muted: { color: '#A6B1A8', fontSize: 13, lineHeight: 19, marginTop: 4 }, warning: { color: '#FFD36B', fontSize: 13 }, state: { margin: 18, padding: 16, backgroundColor: '#19221B', borderRadius: 8 }, error: { color: '#FF9B84' },
  screenContent: { padding: 16, gap: 12, paddingBottom: 28 }, field: { gap: 6 }, fieldLabel: { color: '#AEB9B0', fontSize: 13, fontWeight: '700' }, input: { minHeight: 43, paddingHorizontal: 11, borderWidth: 1, borderColor: '#3B493F', borderRadius: 7, color: '#F1F5F1', backgroundColor: '#151D17', fontSize: 15 },
  actionButton: { minHeight: 43, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: 7, backgroundColor: '#D5FF66' }, actionSecondary: { backgroundColor: '#26342A', alignSelf: 'flex-start' }, actionText: { color: '#17210D', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 }, actionTextAlt: { color: '#E6EEE8' }, disabled: { opacity: 0.45 }, pressed: { opacity: 0.75 },
  choiceList: { flexDirection: 'row', gap: 7 }, choice: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 7, borderWidth: 1, borderColor: '#3B493F' }, choiceSelected: { backgroundColor: '#D5FF66', borderColor: '#D5FF66' }, choiceText: { color: '#C4CEC5', fontSize: 13, fontWeight: '700' }, choiceTextSelected: { color: '#17210D' }, listItem: { paddingVertical: 9, borderTopWidth: 1, borderColor: '#344238', gap: 5 },
  tabBar: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#28342B', backgroundColor: '#151D17' },
  tabButton: { flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  tabPressed: { backgroundColor: '#1C261F' },
  tabIndicator: { position: 'absolute', top: 0, left: '22%', right: '22%', height: 2, borderRadius: 1, backgroundColor: 'transparent' },
  tabIndicatorSelected: { backgroundColor: '#D5FF66' },
  tabText: { color: '#A6B1A8', fontSize: 12, fontWeight: '700' },
  tabTextSelected: { color: '#D5FF66' },
  orgScroll: { flexGrow: 0 },
  heroValue: { color: '#D5FF66', fontSize: 28, fontWeight: '900', marginTop: 2, fontVariant: ['tabular-nums'] },
  kpiRow: { flexDirection: 'row', gap: 10 },
  kpi: { flex: 1 },
  full: { width: '100%' },
  delta: { color: '#A6B1A8', fontSize: 13, fontWeight: '700', marginTop: 4 },
  deltaUp: { color: '#D5FF66' },
});
