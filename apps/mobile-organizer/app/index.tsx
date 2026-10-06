import {
  ApiError,
  ORGANIZATION_ROLES,
  changeMemberRole,
  createEvent,
  createSession,
  createTicketType,
  createVenue,
  createZone,
  fetchOrganizationSales,
  getMembers,
  getAuditLogs,
  getEvent,
  getMyOrganizations,
  getMyPermissions,
  getOrganizationDashboard,
  getOrganization,
  getPendingInvitations,
  inviteMember,
  listEvents,
  listVenues,
  removeMember,
  deleteSession,
  deleteTicketType,
  renameOrganization,
  searchOrganizationTickets,
  updateEvent,
  updateSession,
  updateTicketType,
  unpublishEvent,
  publishEvent,
  type AdminEventRow,
  type AdminEventDetail,
  type AdminVenue,
  type Member,
  type OrganizationRole,
  type OrganizationSales,
  type OrganizationSummary,
  type AuditEntry,
  type OrganizationTicketPage,
  type PendingInvitation,
} from '@nexaticket/ts-sdk';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LoginButton } from '@/components/LoginButton';
import { RevenueBarChart, type EventRevenue } from '@/components/RevenueBarChart';
import { api } from '@/lib/api';
import { useMobileAuth } from '@/lib/auth-context';

type OrganizerTab = 'overview' | 'events' | 'venues' | 'members' | 'sales' | 'tickets' | 'audit' | 'settings';
const TABS: { key: OrganizerTab; label: string }[] = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'events', label: 'Sự kiện' },
  { key: 'venues', label: 'Địa điểm' },
  { key: 'members', label: 'Thành viên' },
  { key: 'sales', label: 'Doanh thu' },
  { key: 'tickets', label: 'Vé' },
  { key: 'audit', label: 'Nhật ký' },
  { key: 'settings', label: 'Cài đặt' },
];

/*
 * Thanh dưới chỉ giữ 4 việc làm hằng ngày; phần còn lại vào bảng "Thêm".
 *
 * Bản trước xếp cả 8 tab thành một hàng cuộn ngang chữ 9px: phải cuộn mới thấy hết, khó bấm, và
 * vì là `ScrollView` (mặc định `flexGrow: 1`) nên thanh còn phình ra chia chiều cao với nội dung.
 */
const PRIMARY_TABS: OrganizerTab[] = ['overview', 'events', 'sales', 'tickets'];
const MORE_TABS: OrganizerTab[] = ['venues', 'members', 'audit', 'settings'];
const tabLabel = (key: OrganizerTab) => TABS.find((item) => item.key === key)?.label ?? key;

export default function OrganizerHome() {
  const { ready, signedIn, signOut } = useMobileAuth();
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [tab, setTab] = useState<OrganizerTab>('overview');
  const [moreOpen, setMoreOpen] = useState(false);
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

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <View><Text style={styles.brand}>NEXATICKET / ORGANIZER</Text><Text style={styles.headerTitle}>{tabTitle(tab)}</Text></View>
        <Pressable accessibilityRole="button" onPress={() => { setLoading(true); void signOut(); }}><Text style={styles.signOut}>Đăng xuất</Text></Pressable>
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
            {tab === 'venues' ? <VenuesScreen organizationId={organization.id} /> : null}
            {tab === 'members' ? <MembersScreen organizationId={organization.id} /> : null}
            {tab === 'sales' ? <SalesScreen organizationId={organization.id} /> : null}
            {tab === 'tickets' ? <TicketsScreen organizationId={organization.id} /> : null}
            {tab === 'audit' ? <AuditScreen organizationId={organization.id} /> : null}
            {tab === 'settings' ? <SettingsScreen organizationId={organization.id} /> : null}
          </>
        )}
      </View>

      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 6) }]} accessibilityRole="tablist">
        {PRIMARY_TABS.map((key) => (
          <TabButton key={key} label={tabLabel(key)} selected={tab === key} onPress={() => setTab(key)} />
        ))}
        <TabButton
          label={MORE_TABS.includes(tab) ? tabLabel(tab) : 'Thêm'}
          selected={MORE_TABS.includes(tab)}
          onPress={() => setMoreOpen(true)}
          more
        />
      </View>

      <Modal visible={moreOpen} transparent animationType="fade" onRequestClose={() => setMoreOpen(false)}>
        <Pressable style={styles.sheetBackdrop} accessibilityLabel="Đóng" onPress={() => setMoreOpen(false)}>
          {/* Chặn chạm xuyên qua bảng xuống lớp nền (lớp nền bấm là đóng). */}
          <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Thêm</Text>
            {MORE_TABS.map((key) => (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: tab === key }}
                onPress={() => { setTab(key); setMoreOpen(false); }}
                style={({ pressed }) => [styles.sheetItem, tab === key && styles.sheetItemSelected, pressed && styles.sheetItemPressed]}
              >
                <Text style={[styles.sheetItemText, tab === key && styles.sheetItemTextSelected]}>{tabLabel(key)}</Text>
                {tab === key ? <Text style={styles.sheetCheck}>✓</Text> : <Text style={styles.sheetChevron}>›</Text>}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function OverviewScreen({ organizationId }: { organizationId: string }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getOrganizationDashboard>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    getOrganizationDashboard(api, organizationId).then((value) => { if (active) setData(value); }).catch(() => { if (active) setError('Không tải được tổng quan tổ chức.'); });
    return () => { active = false; };
  }, [organizationId]);
  if (error) return <StateCard title="Tổng quan chưa khả dụng" detail={error} />;
  if (!data) return <LoadingState />;
  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <Text style={styles.sectionHeading}>HIỆU QUẢ TỔ CHỨC</Text>
      <View style={styles.statGrid}>
        <Stat label="Sự kiện" value={data.totals.eventCount} />
        <Stat label="Đang bán" value={data.totals.publishedCount} />
        <Stat label="Vé đã bán" value={data.totals.ticketsSold} />
        <Stat label="Doanh thu" value={data.degraded.includes('analytics') ? '—' : money(data.totals.grossVnd)} />
      </View>
      {data.degraded.length > 0 ? <Text style={styles.warning}>Một số dữ liệu đang tạm thời không khả dụng.</Text> : null}
      <Section title="Sự kiện gần đây">
        {data.events.slice(0, 10).map((event) => <EventRow key={event.id} event={event} />)}
        {data.events.length === 0 ? <Text style={styles.muted}>Chưa có sự kiện.</Text> : null}
      </Section>
    </ScrollView>
  );
}

function EventsScreen({ organizationId }: { organizationId: string }) {
  const [events, setEvents] = useState<AdminEventRow[]>([]);
  const [venues, setVenues] = useState<AdminVenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('nhac-song');
  const [venueId, setVenueId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [detail, setDetail] = useState<AdminEventDetail | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [sessionStartsAt, setSessionStartsAt] = useState('');
  const [salesOpenAt, setSalesOpenAt] = useState('');
  const [salesCloseAt, setSalesCloseAt] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [ticketName, setTicketName] = useState('');
  const [ticketPrice, setTicketPrice] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([listEvents(api, organizationId), listVenues(api, organizationId)])
      .then(([eventRows, venueRows]) => { if (active) { setEvents(eventRows); setVenues(venueRows); setVenueId((current) => current || venueRows[0]?.id || ''); } })
      .catch(() => { if (active) setMessage('Không tải được sự kiện hoặc địa điểm.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [organizationId, reload]);

  useEffect(() => {
    if (!selectedEventId) return;
    let active = true;
    getEvent(api, organizationId, selectedEventId).then((value) => {
      if (active) { setDetail(value); setEditTitle(value.title); setEditCategory(value.category); setZoneId(value.venue.zones[0]?.id ?? ''); }
    }).catch(() => { if (active) setMessage('Không tải được chi tiết sự kiện.'); });
    return () => { active = false; };
  }, [organizationId, selectedEventId, reload]);

  async function create() {
    if (!title.trim() || !venueId) { setMessage('Nhập tên sự kiện và chọn địa điểm.'); return; }
    setBusy(true); setMessage(null);
    try {
      await createEvent(api, organizationId, { venueId, title: title.trim(), category });
      setTitle(''); setMessage('Đã tạo sự kiện nháp.'); setReload((value) => value + 1);
    } catch { setMessage('Không tạo được sự kiện. Kiểm tra quyền và thông tin nhập.'); }
    finally { setBusy(false); }
  }

  async function togglePublish(event: AdminEventRow) {
    setBusy(true); setMessage(null);
    try {
      if (event.status === 'PUBLISHED') await unpublishEvent(api, organizationId, event.id);
      else await publishEvent(api, organizationId, event.id);
      setReload((value) => value + 1);
    } catch (cause) { setMessage(cause instanceof ApiError ? cause.detail ?? 'Không đổi được trạng thái.' : 'Không đổi được trạng thái.'); }
    finally { setBusy(false); }
  }

  if (loading) return <LoadingState />;
  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <Section title="Tạo sự kiện">
        <Field label="Tên sự kiện" value={title} onChangeText={setTitle} placeholder="Ví dụ: Đêm nhạc mùa hè" />
        <Field label="Thể loại" value={category} onChangeText={setCategory} placeholder="nhac-song" />
        <Text style={styles.muted}>Địa điểm</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choiceList}>
          {venues.map((venue) => <Choice key={venue.id} label={venue.name} selected={venue.id === venueId} onPress={() => setVenueId(venue.id)} />)}
        </ScrollView>
        <ActionButton label={busy ? 'ĐANG TẠO...' : 'TẠO BẢN NHÁP'} onPress={() => void create()} disabled={busy || venues.length === 0} />
        {venues.length === 0 ? <Text style={styles.warning}>Cần tạo địa điểm trước khi tạo sự kiện.</Text> : null}
        {message ? <Text style={styles.muted}>{message}</Text> : null}
      </Section>
      <Section title={`Danh sách sự kiện (${events.length})`}>
        {events.map((event) => <View key={event.id} style={styles.listItem}>
          <EventRow event={event} />
          <ActionButton label={selectedEventId === event.id ? 'ĐANG CHỌN' : 'CẤU HÌNH'} onPress={() => setSelectedEventId(event.id)} secondary />
          <ActionButton label={event.status === 'PUBLISHED' ? 'GỠ BÁN' : 'XUẤT BẢN'} onPress={() => void togglePublish(event)} disabled={busy || event.status === 'CANCELLED'} secondary />
        </View>)}
        {events.length === 0 ? <Text style={styles.muted}>Chưa có sự kiện.</Text> : null}
      </Section>
      {detail ? <>
        <Section title={`Cấu hình · ${detail.title}`}>
          <Field label="Tên sự kiện" value={editTitle} onChangeText={setEditTitle} />
          <Field label="Thể loại" value={editCategory} onChangeText={setEditCategory} />
          <ActionButton label="LƯU THÔNG TIN" onPress={() => void performDetail(() => updateEvent(api, organizationId, detail.id, { title: editTitle.trim(), category: editCategory.trim() }))} disabled={busy || !editTitle.trim() || !editCategory.trim()} />
        </Section>
        <Section title="Thêm suất diễn">
          <Field label="Bắt đầu (ISO-8601)" value={sessionStartsAt} onChangeText={setSessionStartsAt} placeholder="2026-08-20T19:00:00+07:00" />
          <Field label="Mở bán (ISO-8601)" value={salesOpenAt} onChangeText={setSalesOpenAt} placeholder="2026-08-01T09:00:00+07:00" />
          <Field label="Đóng bán (ISO-8601)" value={salesCloseAt} onChangeText={setSalesCloseAt} placeholder="2026-08-20T18:00:00+07:00" />
          <ActionButton label="TẠO SUẤT" onPress={() => void performDetail(() => createSession(api, organizationId, detail.id, { startsAt: sessionStartsAt, salesOpenAt, salesCloseAt }))} disabled={busy || !sessionStartsAt || !salesOpenAt || !salesCloseAt} />
        </Section>
        <Section title="Hạng vé và suất diễn">
          <Field label="Tên hạng vé mới" value={ticketName} onChangeText={setTicketName} />
          <Field label="Giá (VND)" value={ticketPrice} onChangeText={setTicketPrice} keyboardType="numeric" />
          <Text style={styles.muted}>Chọn khu vé</Text>
          <ScrollView horizontal contentContainerStyle={styles.choiceList}>{detail.venue.zones.map((zone) => <Choice key={zone.id} label={zone.name} selected={zone.id === zoneId} onPress={() => setZoneId(zone.id)} />)}</ScrollView>
          {detail.sessions.map((session) => <View key={session.id} style={styles.listItem}>
            <Text style={styles.cardTitle}>{formatDate(session.startsAt)}</Text>
            <Text selectable style={styles.muted}>Session {session.id}</Text>
            <Field label="Cập nhật giờ bắt đầu (ISO-8601)" value={sessionStartsAt} onChangeText={setSessionStartsAt} placeholder={session.startsAt} />
            <View style={styles.inlineActions}><ActionButton secondary label="LƯU SUẤT" onPress={() => void performDetail(() => updateSession(api, organizationId, detail.id, session.id, { startsAt: sessionStartsAt || session.startsAt }))} disabled={busy} /><ActionButton secondary label="XOÁ SUẤT" onPress={() => void performDetail(() => deleteSession(api, organizationId, detail.id, session.id))} disabled={busy} /><ActionButton label="THÊM HẠNG VÉ" onPress={() => void performDetail(() => createTicketType(api, organizationId, detail.id, session.id, { venueZoneId: zoneId, name: ticketName.trim(), priceVnd: Number(ticketPrice) }))} disabled={busy || !zoneId || !ticketName.trim() || !Number.isFinite(Number(ticketPrice))} /></View>
            {session.ticketTypes.map((ticket) => <View key={ticket.id} style={styles.ticketRow}><View style={styles.rowText}><Text style={styles.cardTitle}>{ticket.name} · {money(ticket.priceVnd)}</Text><Text style={styles.muted}>{ticket.zoneName} · sức chứa {ticket.capacity}</Text><View style={styles.inlineActions}><ActionButton secondary label="CẬP NHẬT" onPress={() => void performDetail(() => updateTicketType(api, organizationId, detail.id, session.id, ticket.id, { name: ticketName.trim() || ticket.name, priceVnd: ticketPrice ? Number(ticketPrice) : ticket.priceVnd }))} disabled={busy} /><ActionButton danger label="XOÁ" onPress={() => void performDetail(() => deleteTicketType(api, organizationId, detail.id, session.id, ticket.id))} disabled={busy} /></View></View></View>)}
          </View>)}
          {detail.sessions.length === 0 ? <Text style={styles.muted}>Tạo suất diễn trước khi thêm hạng vé.</Text> : null}
        </Section>
      </> : null}
    </ScrollView>
  );

  async function performDetail(operation: () => Promise<unknown>) {
    setBusy(true); setMessage(null);
    try { await operation(); setReload((value) => value + 1); }
    catch (cause) { setMessage(cause instanceof ApiError ? cause.detail ?? 'Không lưu được thay đổi.' : 'Không lưu được thay đổi.'); }
    finally { setBusy(false); }
  }
}

function VenuesScreen({ organizationId }: { organizationId: string }) {
  const [venues, setVenues] = useState<AdminVenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [zoneName, setZoneName] = useState('');
  const [zoneCode, setZoneCode] = useState('');
  const [zoneKind, setZoneKind] = useState<'SEATED' | 'STANDING'>('STANDING');
  const [zoneCapacity, setZoneCapacity] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    listVenues(api, organizationId).then((rows) => { if (active) setVenues(rows); }).catch(() => { if (active) setMessage('Không tải được địa điểm.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [organizationId, reload]);
  async function create() {
    if (!name.trim() || !city.trim()) { setMessage('Nhập tên địa điểm và thành phố.'); return; }
    setBusy(true); setMessage(null);
    try { await createVenue(api, organizationId, { name: name.trim(), city: city.trim() }); setName(''); setMessage('Đã tạo địa điểm.'); setReload((value) => value + 1); }
    catch { setMessage('Không tạo được địa điểm.'); }
    finally { setBusy(false); }
  }
  if (loading) return <LoadingState />;
  return <ScrollView contentContainerStyle={styles.screenContent}>
    <Section title="Thêm địa điểm"><Field label="Tên địa điểm" value={name} onChangeText={setName} /><Field label="Thành phố" value={city} onChangeText={setCity} /><ActionButton label={busy ? 'ĐANG LƯU...' : 'TẠO ĐỊA ĐIỂM'} onPress={() => void create()} disabled={busy} />{message ? <Text style={styles.muted}>{message}</Text> : null}</Section>
    <Section title={`Địa điểm (${venues.length})`}>{venues.map((venue) => <View key={venue.id} style={styles.listItem}><Text style={styles.cardTitle}>{venue.name}</Text><Text style={styles.muted}>{venue.city} · {venue.zones.length} khu · sức chứa {venue.capacity}</Text><Text selectable style={styles.muted}>{venue.id}</Text><Field label="Mã khu" value={zoneCode} onChangeText={setZoneCode} /><Field label="Tên khu" value={zoneName} onChangeText={setZoneName} /><View style={styles.inlineActions}><Choice label="Đứng" selected={zoneKind === 'STANDING'} onPress={() => setZoneKind('STANDING')} /><Choice label="Ngồi" selected={zoneKind === 'SEATED'} onPress={() => setZoneKind('SEATED')} /></View>{zoneKind === 'STANDING' ? <Field label="Sức chứa" value={zoneCapacity} onChangeText={setZoneCapacity} keyboardType="numeric" /> : <Field label="Số hàng, ghế mỗi hàng" value={zoneCapacity} onChangeText={setZoneCapacity} keyboardType="numeric" placeholder="20, 12" />}<ActionButton label="THÊM KHU" onPress={() => void (async () => { try { const [rowCount, seatsPerRow] = zoneCapacity.split(',').map((value) => Number(value.trim())); await createZone(api, organizationId, venue.id, { zoneCode: zoneCode.trim(), name: zoneName.trim(), kind: zoneKind, ...(zoneKind === 'STANDING' ? { capacity: Number(zoneCapacity) } : { rowCount, seatsPerRow }) }); setMessage('Đã thêm khu.'); setZoneName(''); setZoneCode(''); setZoneCapacity(''); setReload((value) => value + 1); } catch { setMessage('Không thêm được khu. Kiểm tra mã và sức chứa.'); } })()} disabled={!zoneCode.trim() || !zoneName.trim() || !zoneCapacity.trim()} /><View style={styles.zoneList}>{venue.zones.map((zone) => <Text key={zone.id} style={styles.muted}>{zone.zoneCode} · {zone.name} · {zone.kind} · {zone.seatCount} vé</Text>)}</View></View>)}</Section>
  </ScrollView>;
}

function MembersScreen({ organizationId }: { organizationId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<OrganizationRole>('CHECKIN_STAFF');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.all([getMembers(api, organizationId), getPendingInvitations(api, organizationId)])
      .then(([rows, pending]) => { if (active) { setMembers(rows); setInvitations(pending); } })
      .catch(() => { if (active) setMessage('Không tải được danh sách thành viên.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [organizationId, reload]);
  async function sendInvite() {
    if (!email.includes('@')) { setMessage('Nhập email hợp lệ.'); return; }
    setBusy(true); setMessage(null);
    try { await inviteMember(api, organizationId, { email: email.trim(), role }); setEmail(''); setMessage('Đã gửi lời mời. Staff đăng nhập app để chấp nhận.'); setReload((value) => value + 1); }
    catch { setMessage('Không gửi được lời mời.'); }
    finally { setBusy(false); }
  }
  async function changeRole(member: Member) {
    const next = member.role === 'CHECKIN_STAFF' ? 'EVENT_MANAGER' : 'CHECKIN_STAFF';
    setBusy(true);
    try { await changeMemberRole(api, organizationId, member.userId, next); setMessage(`Đã đổi vai trò thành ${next}.`); setReload((value) => value + 1); }
    catch { setMessage('Không đổi được vai trò.'); }
    finally { setBusy(false); }
  }
  async function remove(member: Member) {
    Alert.alert('Gỡ thành viên', `Gỡ ${member.email ?? member.userId} khỏi tổ chức?`, [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Gỡ', style: 'destructive', onPress: () => { void removeMember(api, organizationId, member.userId).then(() => setReload((value) => value + 1)).catch(() => setMessage('Không gỡ được thành viên.')); } },
    ]);
  }
  if (loading) return <LoadingState />;
  return <ScrollView contentContainerStyle={styles.screenContent}>
    <Section title="Mời thành viên"><Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" /><Text style={styles.muted}>Chọn vai trò</Text><ScrollView horizontal contentContainerStyle={styles.choiceList}>{ORGANIZATION_ROLES.map((item) => <Choice key={item} label={roleLabel(item)} selected={item === role} onPress={() => setRole(item)} />)}</ScrollView><ActionButton label={busy ? 'ĐANG GỬI...' : 'GỬI LỜI MỜI'} onPress={() => void sendInvite()} disabled={busy} />{message ? <Text style={styles.muted}>{message}</Text> : null}</Section>
    <Section title={`Thành viên (${members.length})`}>{members.map((member) => <View key={member.userId} style={styles.listItem}><Text style={styles.cardTitle}>{member.fullName ?? member.email ?? member.userId}</Text><Text style={styles.muted}>{member.email} · {roleLabel(member.role)}</Text><View style={styles.inlineActions}><ActionButton secondary label="ĐỔI ROLE" onPress={() => void changeRole(member)} disabled={busy} /><ActionButton danger label="GỠ" onPress={() => void remove(member)} disabled={busy} /></View></View>)}</Section>
    <Section title={`Lời mời chờ (${invitations.length})`}>{invitations.map((invitation) => <View key={invitation.id} style={styles.listItem}><Text style={styles.cardTitle}>{invitation.email}</Text><Text style={styles.muted}>{roleLabel(invitation.role)} · {invitation.expired ? 'Đã hết hạn' : `Hết hạn ${formatDate(invitation.expiresAt)}`}</Text></View>)}</Section>
  </ScrollView>;
}

function SalesScreen({ organizationId }: { organizationId: string }) {
  const [sales, setSales] = useState<OrganizationSales | null>(null);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    // Doanh thu chỉ có eventId; tên sự kiện lấy từ danh sách sự kiện của tổ chức. Không tải được tên
    // thì vẫn hiện số liệu — chỉ thiếu tên — chứ không chặn cả màn.
    Promise.all([fetchOrganizationSales(api, organizationId), listEvents(api, organizationId).catch(() => [] as AdminEventRow[])])
      .then(([value, events]) => {
        if (!active) return;
        setSales(value);
        setTitles(Object.fromEntries(events.map((event) => [event.id, event.title])));
      })
      .catch(() => { if (active) setError('Không tải được doanh thu.'); });
    return () => { active = false; };
  }, [organizationId]);

  const byEvent = useMemo<EventRevenue[]>(() => {
    if (!sales) return [];
    const groups = new Map<string, EventRevenue>();
    for (const row of sales.sessions) {
      const current = groups.get(row.eventId) ?? {
        eventId: row.eventId,
        title: titles[row.eventId] ?? `Sự kiện ${row.eventId.slice(0, 8)}`,
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
  }, [sales, titles]);

  if (error) return <StateCard title="Doanh thu chưa khả dụng" detail={error} />;
  if (!sales) return <LoadingState />;

  const ordersPaid = sales.sessions.reduce((sum, row) => sum + row.ordersPaid, 0);
  const sessionsSorted = [...sales.sessions].sort((a, b) => b.grossVnd - a.grossVnd);

  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      {/* Con số chính đứng một mình, to nhất; hai số phụ xếp cạnh nhau bên dưới. */}
      <View style={styles.stat}>
        <Text style={styles.muted}>Tổng doanh thu</Text>
        <Text style={styles.heroValue}>{money(sales.totalGrossVnd)}</Text>
      </View>
      <View style={styles.kpiRow}>
        <View style={[styles.stat, styles.kpi]}><Text style={styles.statValue}>{sales.totalTicketsSold}</Text><Text style={styles.muted}>Vé đã bán</Text></View>
        <View style={[styles.stat, styles.kpi]}><Text style={styles.statValue}>{ordersPaid}</Text><Text style={styles.muted}>Đơn đã thanh toán</Text></View>
      </View>

      <Section title="Doanh thu theo sự kiện">
        <RevenueBarChart rows={byEvent} formatMoney={money} />
      </Section>

      {/* Bảng số liệu đầy đủ — mọi suất, kể cả suất chưa có doanh thu mà biểu đồ không vẽ. */}
      <Section title="Theo suất diễn">
        {sessionsSorted.length === 0 ? <Text style={styles.muted}>Chưa có suất nào.</Text> : sessionsSorted.map((row) => (
          <View key={row.eventSessionId} style={styles.listItem}>
            <Text style={styles.cardTitle}>{titles[row.eventId] ?? `Sự kiện ${row.eventId.slice(0, 8)}`}</Text>
            <Text style={styles.muted}>{money(row.grossVnd)} · {row.ticketsSold} vé · {row.ordersPaid} đơn đã trả · {row.ordersExpired} hết hạn · {row.ordersCancelled} huỷ</Text>
          </View>
        ))}
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

function AuditScreen({ organizationId }: { organizationId: string }) {
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    getAuditLogs(api, organizationId, { limit: 50, offset: 0 }).then((data) => { if (active) setRows(data); }).catch(() => { if (active) setRows([]); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [organizationId]);
  if (loading) return <LoadingState />;
  return <ScrollView contentContainerStyle={styles.screenContent}><Section title="Nhật ký tổ chức">{rows.map((row) => <View key={row.id} style={styles.listItem}><Text style={styles.cardTitle}>{row.action}</Text><Text style={styles.muted}>{new Date(row.createdAt).toLocaleString('vi-VN')} · {row.entityType} · {row.entityId ?? '—'}</Text><Text selectable style={styles.muted}>Thực hiện bởi {row.actorUserId ?? 'hệ thống'}</Text></View>)}{rows.length === 0 ? <Text style={styles.muted}>Không có nhật ký hoặc tài khoản chưa được cấp quyền ORG_AUDIT_READ.</Text> : null}</Section></ScrollView>;
}

function SettingsScreen({ organizationId }: { organizationId: string }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    getOrganization(api, organizationId).then((organization) => { if (active) { setName(organization.name); setSlug(organization.slug); } }).catch(() => { if (active) setMessage('Không tải được hồ sơ tổ chức.'); });
    return () => { active = false; };
  }, [organizationId]);
  return <ScrollView contentContainerStyle={styles.screenContent}><Section title="Hồ sơ tổ chức"><Field label="Tên tổ chức" value={name} onChangeText={setName} /><Field label="Slug công khai (chỉ đọc)" value={slug} onChangeText={() => undefined} /><Text style={styles.muted}>Slug được giữ nguyên để không làm hỏng liên kết sự kiện.</Text><ActionButton label="LƯU TÊN" onPress={() => void renameOrganization(api, organizationId, name.trim()).then(() => setMessage('Đã cập nhật tên tổ chức.')).catch(() => setMessage('Không cập nhật được. Cần quyền ORG_PROFILE_MANAGE.'))} />{message ? <Text style={styles.muted}>{message}</Text> : null}</Section><Section title="Phạm vi quản trị"><Text style={styles.muted}>Các cấu hình chưa có API quản trị công khai không được thay đổi từ app.</Text></Section></ScrollView>;
}

function EventRow({ event }: { event: AdminEventRow }) { return <View style={styles.eventRow}><View style={styles.rowText}><Text style={styles.cardTitle}>{event.title}</Text><Text style={styles.muted}>{event.venueName ?? 'Chưa có địa điểm'} · {event.sessionCount} suất</Text></View><Text style={styles.badge}>{event.status}</Text></View>; }
function Section({ title, children }: { title: string; children: ReactNode }) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>; }
function Stat({ label, value }: { label: string; value: string | number }) { return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.muted}>{label}</Text></View>; }
function StateCard({ title, detail }: { title: string; detail: string }) { return <View style={styles.state}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.muted}>{detail}</Text></View>; }
function LoadingState() { return <View style={styles.center}><ActivityIndicator color="#D5FF66" /></View>; }
function Field(props: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; keyboardType?: 'default' | 'email-address' | 'numeric'; autoCapitalize?: 'none' | 'sentences' }) { return <View style={styles.field}><Text style={styles.fieldLabel}>{props.label}</Text><TextInput {...props} placeholder={props.placeholder} placeholderTextColor="#77847A" style={styles.input} autoCapitalize={props.autoCapitalize ?? 'sentences'} /></View>; }
function ActionButton({ label, onPress, disabled, secondary, danger }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean; danger?: boolean }) { return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.actionButton, secondary && styles.actionSecondary, danger && styles.actionDanger, disabled && styles.disabled, pressed && styles.pressed]}><Text style={[styles.actionText, (secondary || danger) && styles.actionTextAlt]}>{label}</Text></Pressable>; }
function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.choice, selected && styles.choiceSelected]}><Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text></Pressable>; }
function roleLabel(role: string) { return ({ ORG_OWNER: 'Chủ tổ chức', ORG_ADMIN: 'Quản trị tổ chức', EVENT_MANAGER: 'Quản lý sự kiện', CHECKIN_STAFF: 'Soát vé' } as Record<string, string>)[role] ?? role; }
function money(value: number) { return `${new Intl.NumberFormat('vi-VN').format(value)}đ`; }
function formatDate(value: string) { return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(value)); }
function tabTitle(tab: OrganizerTab) { return ({ overview: 'Tổng quan', events: 'Sự kiện', venues: 'Địa điểm', members: 'Thành viên', sales: 'Doanh thu', tickets: 'Tra cứu vé', audit: 'Nhật ký', settings: 'Cài đặt' })[tab]; }

function TabButton({ label, selected, onPress, more = false }: { label: string; selected: boolean; onPress: () => void; more?: boolean }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityHint={more ? 'Mở các mục khác' : undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.tabButton, pressed && styles.tabPressed]}
    >
      <View style={[styles.tabIndicator, selected && styles.tabIndicatorSelected]} />
      <Text numberOfLines={1} style={[styles.tabText, selected && styles.tabTextSelected]}>
        {label}
        {more ? ' ▴' : ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111713' }, header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#28342B' },
  brand: { color: '#D5FF66', fontSize: 11, fontWeight: '900', letterSpacing: 1.3 }, headerTitle: { color: '#F1F5F1', fontSize: 20, fontWeight: '900', marginTop: 4 }, signOut: { color: '#A6B1A8', fontSize: 13 },
  sectionHeading: { color: '#D5FF66', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  orgList: { paddingHorizontal: 16, paddingVertical: 10, gap: 7 }, orgChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 7, borderWidth: 1, borderColor: '#3B493F' }, orgChipSelected: { backgroundColor: '#D5FF66', borderColor: '#D5FF66' }, orgChipText: { color: '#CAD3CB', fontSize: 13, fontWeight: '700' }, orgChipTextSelected: { color: '#17210D' },
  body: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, login: { flex: 1, justifyContent: 'center', padding: 24, gap: 14 }, content: { padding: 18, gap: 15, paddingBottom: 30 },
  title: { color: '#F1F5F1', fontSize: 27, fontWeight: '900' }, orgHeading: { color: '#E9F0E9', fontSize: 15, fontWeight: '800' }, statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, stat: { width: '48%', minHeight: 82, justifyContent: 'center', padding: 13, borderRadius: 8, backgroundColor: '#1B241D', borderWidth: 1, borderColor: '#344238' }, statValue: { color: '#D5FF66', fontSize: 22, fontWeight: '900' },
  section: { padding: 14, gap: 10, borderRadius: 8, borderWidth: 1, borderColor: '#344238', backgroundColor: '#19221B' }, sectionTitle: { color: '#F1F5F1', fontSize: 17, fontWeight: '800' }, eventRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingTop: 9, borderTopWidth: 1, borderColor: '#344238' }, rowText: { flex: 1 }, cardTitle: { color: '#F1F5F1', fontSize: 15, fontWeight: '800' }, badge: { color: '#D5FF66', fontSize: 10, fontWeight: '900' },
  muted: { color: '#A6B1A8', fontSize: 13, lineHeight: 19, marginTop: 4 }, warning: { color: '#FFD36B', fontSize: 13 }, state: { margin: 18, padding: 16, backgroundColor: '#19221B', borderRadius: 8 }, error: { color: '#FF9B84' },
  screenContent: { padding: 16, gap: 12, paddingBottom: 28 }, field: { gap: 6 }, fieldLabel: { color: '#AEB9B0', fontSize: 13, fontWeight: '700' }, input: { minHeight: 43, paddingHorizontal: 11, borderWidth: 1, borderColor: '#3B493F', borderRadius: 7, color: '#F1F5F1', backgroundColor: '#151D17', fontSize: 15 },
  actionButton: { minHeight: 43, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: 7, backgroundColor: '#D5FF66' }, actionSecondary: { backgroundColor: '#26342A', alignSelf: 'flex-start' }, actionDanger: { backgroundColor: '#522A27', alignSelf: 'flex-start' }, actionText: { color: '#17210D', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 }, actionTextAlt: { color: '#E6EEE8' }, disabled: { opacity: 0.45 }, pressed: { opacity: 0.75 },
  choiceList: { flexDirection: 'row', gap: 7 }, choice: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 7, borderWidth: 1, borderColor: '#3B493F' }, choiceSelected: { backgroundColor: '#D5FF66', borderColor: '#D5FF66' }, choiceText: { color: '#C4CEC5', fontSize: 13, fontWeight: '700' }, choiceTextSelected: { color: '#17210D' }, listItem: { paddingVertical: 9, borderTopWidth: 1, borderColor: '#344238', gap: 5 }, inlineActions: { flexDirection: 'row', gap: 7, marginTop: 5 },
  ticketRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingVertical: 6, borderTopWidth: 1, borderColor: '#344238' },
  zoneList: { gap: 2 },
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
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { paddingHorizontal: 14, paddingTop: 8, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, borderColor: '#28342B', backgroundColor: '#151D17' },
  sheetHandle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: '#3B493F', marginBottom: 10 },
  sheetTitle: { color: '#A6B1A8', fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 6, paddingHorizontal: 6 },
  sheetItem: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderRadius: 9 },
  sheetItemSelected: { backgroundColor: '#20291C' },
  sheetItemPressed: { backgroundColor: '#1C261F' },
  sheetItemText: { color: '#F1F5F1', fontSize: 15, fontWeight: '700' },
  sheetItemTextSelected: { color: '#D5FF66' },
  sheetCheck: { color: '#D5FF66', fontSize: 16, fontWeight: '900' },
  sheetChevron: { color: '#6F7B72', fontSize: 20 },
});