import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  activateOrganization, addKnowledgeChunk, ApiError, claimHandoff, createOrganization,
  deleteKnowledgeChunk, getEventRules, getHandoffThread, getMyPermissions, grantMember,
  getPlatformAuditLogs, getTrialBalance, listHandoffs, listKnowledgeChunks,
  listPlatformOrganizations, previewKnowledge, replyToHandoff, resolveHandoff,
  saveEventRules, suspendOrganization,
  type AuditEntry, type EventRules, type Handoff, type KnowledgeChunk,
  type OrganizationSummary, type RetrievedChunk, type TrialBalance,
} from '@nexaticket/ts-sdk';
import { LoginButton } from '@/components/LoginButton';
import { useMobileAuth } from '@/lib/auth-context';
import { redirectUri } from '@/lib/auth-session';
import { api } from '@/lib/api';

type Section = 'organizations' | 'audit' | 'ledger' | 'support' | 'knowledge' | 'rules' | 'templates' | 'account';
const sections: { id: Section; label: string; permission?: string }[] = [
  { id: 'organizations', label: 'Tổ chức', permission: 'PLATFORM_ORG_MANAGE' },
  { id: 'audit', label: 'Audit', permission: 'PLATFORM_AUDIT_READ' },
  { id: 'ledger', label: 'Sổ cái', permission: 'PLATFORM_FINANCE_VIEW' },
  { id: 'support', label: 'Hỗ trợ', permission: 'PLATFORM_SUPPORT_HANDLE' },
  { id: 'knowledge', label: 'Tri thức', permission: 'PLATFORM_SUPPORT_HANDLE' },
  { id: 'rules', label: 'Luật sự kiện', permission: 'PLATFORM_SUPPORT_HANDLE' },
  { id: 'templates', label: 'Mẫu sự kiện', permission: 'PLATFORM_TEMPLATE_MANAGE' },
  { id: 'account', label: 'Tài khoản' },
];

export default function PlatformHome() {
  const { ready, signedIn, signOut } = useMobileAuth();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [section, setSection] = useState<Section>('organizations');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [balance, setBalance] = useState<TrialBalance | null>(null);
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeChunk[]>([]);
  const [retrieved, setRetrieved] = useState<RetrievedChunk[]>([]);
  const [rules, setRules] = useState<EventRules | null>(null);
  const [templateRows, setTemplateRows] = useState<Record<string, unknown>[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateDetail, setTemplateDetail] = useState<Record<string, unknown> | null>(null);
  const [templateStageJson, setTemplateStageJson] = useState('null');
  const [templateZonesJson, setTemplateZonesJson] = useState('[]');
  const [values, setValues] = useState({ name: '', slug: '', email: '', organizationId: '', role: 'ORG_ADMIN', title: '', content: '', eventId: '', question: '', handoffId: '', reply: '' });

  const permitted = (permission?: string) => !permission || permissions.includes(permission);
  const update = (key: keyof typeof values, value: string) => setValues((current) => ({ ...current, [key]: value }));

  const load = useCallback(async (target = section) => {
    if (!signedIn) return;
    setLoading(true);
    setError('');
    try {
      if (target === 'organizations') setOrganizations(await listPlatformOrganizations(api, { limit: 100, offset: 0 }));
      if (target === 'audit') setAudit(await getPlatformAuditLogs(api, { limit: 50, offset: 0 }));
      if (target === 'ledger') setBalance(await getTrialBalance(api));
      if (target === 'support') setHandoffs(await listHandoffs(api, { page: 0, size: 50 }));
      if (target === 'knowledge') setKnowledge(await listKnowledgeChunks(api, { page: 0, size: 100 }));
      if (target === 'templates') setTemplateRows(await api.get<Record<string, unknown>[]>('/v1/platform/concert-templates').then((response) => response.data));
    } catch (reason) {
      setError(reason instanceof ApiError ? `${reason.message}${reason.correlationId ? ` · ${reason.correlationId}` : ''}` : reason instanceof Error ? reason.message : 'Không tải được dữ liệu.');
    } finally { setLoading(false); }
  }, [section, signedIn]);

  useEffect(() => {
    if (!signedIn) return;
    void getMyPermissions(api).then((result) => setPermissions(result.platformPermissions)).catch(() => setPermissions([]));
  }, [signedIn]);
  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function perform(operation: () => Promise<unknown>, target = section) {
    setLoading(true);
    setError('');
    try { await operation(); await load(target); }
    catch (reason) {
      setError(reason instanceof ApiError ? `${reason.message}${reason.correlationId ? ` · ${reason.correlationId}` : ''}` : reason instanceof Error ? reason.message : 'Thao tác thất bại.');
    } finally { setLoading(false); }
  }

  if (!ready) return <Centered><ActivityIndicator color="#C8B5FF" /></Centered>;
  if (!signedIn) return <ScrollView contentContainerStyle={styles.login}><Text style={styles.eyebrow}>NEXATICKET · PLATFORM</Text><Text style={styles.title}>Điều hành nền tảng</Text><Text style={styles.muted}>Đăng nhập bằng tài khoản được cấp quyền superadmin.</Text><LoginButton /><Text selectable style={styles.small}>Callback: {redirectUri}</Text></ScrollView>;

  const activeSection = sections.find((item) => item.id === section);
  return (
    <View style={styles.screen}>
      <View style={styles.topbar}><View><Text style={styles.eyebrow}>NEXATICKET / PLATFORM</Text><Text style={styles.heading}>{activeSection?.label}</Text></View><Pressable onPress={() => void signOut()} style={styles.iconButton}><Text style={styles.iconText}>↪</Text></Pressable></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {sections.filter((item) => permitted(item.permission)).map((item) => <Pressable key={item.id} onPress={() => setSection(item.id)} style={[styles.tab, section === item.id && styles.tabActive]}><Text style={[styles.tabText, section === item.id && styles.tabTextActive]}>{item.label}</Text></Pressable>)}
      </ScrollView>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {loading && <ActivityIndicator color="#C8B5FF" />}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {section === 'organizations' && <>
          <SectionTitle title="Tổ chức" action="Tải lại" onAction={() => void load()} />
          <Field label="Tên tổ chức" value={values.name} onChange={(value) => update('name', value)} />
          <Field label="Slug (không bắt buộc)" value={values.slug} onChange={(value) => update('slug', value)} />
          <Field label="Email chủ sở hữu" value={values.email} onChange={(value) => update('email', value)} />
          <Action label="Tạo tổ chức" onPress={() => void perform(async () => {
            const created = await createOrganization(api, { name: values.name.trim(), ownerEmail: values.email.trim(), ...(values.slug.trim() ? { slug: values.slug.trim() } : {}) });
            Alert.alert('Đã tạo tổ chức', `Mã mời chủ sở hữu: ${created.invitationToken}`);
          })} />
          <Field label="ID tổ chức để cấp thành viên" value={values.organizationId} onChange={(value) => update('organizationId', value)} />
          <Field label="Email thành viên" value={values.email} onChange={(value) => update('email', value)} />
          <Field label="Vai trò: ORG_OWNER / ORG_ADMIN / EVENT_MANAGER / CHECKIN_STAFF" value={values.role} onChange={(value) => update('role', value.toUpperCase())} />
          <Action label="Cấp thành viên" onPress={() => void perform(() => grantMember(api, values.organizationId.trim(), { email: values.email.trim(), role: values.role as 'ORG_OWNER' | 'ORG_ADMIN' | 'EVENT_MANAGER' | 'CHECKIN_STAFF' }))} />
          {organizations.map((org) => <View key={org.id} style={styles.row}><View style={styles.rowMain}><Text style={styles.rowTitle}>{org.name}</Text><Text style={styles.small}>{org.slug} · {org.memberCount} thành viên · {org.status}</Text><Text selectable style={styles.mono}>{org.id}</Text></View><View style={styles.inline}><Action compact label={org.status === 'ACTIVE' ? 'Khoá' : 'Mở'} onPress={() => void perform(() => org.status === 'ACTIVE' ? suspendOrganization(api, org.id) : activateOrganization(api, org.id))} /></View></View>)}
        </>}
        {section === 'audit' && <><SectionTitle title="Nhật ký nền tảng" action="Làm mới" onAction={() => void load()} />{audit.map((item) => <DataRow key={item.id} title={item.action} detail={`${new Date(item.createdAt).toLocaleString()} · ${item.entityType}${item.entityId ? ` · ${item.entityId}` : ''}`} />)}</>}
        {section === 'ledger' && <><SectionTitle title="Bảng cân đối thử" action="Làm mới" onAction={() => void load()} />{balance && <View style={styles.panel}><Text style={[styles.rowTitle, { color: balance.balanced ? '#82D4A4' : '#FF7777' }]}>{balance.balanced ? 'CÂN BẰNG' : 'LỆCH · CẦN XỬ LÝ'}</Text><Text style={styles.metric}>Nợ  {balance.totalDebitVnd.toLocaleString('vi-VN')} ₫</Text><Text style={styles.metric}>Có  {balance.totalCreditVnd.toLocaleString('vi-VN')} ₫</Text></View>}</>}
        {section === 'support' && <><SectionTitle title="Hàng đợi hỗ trợ" action="Làm mới" onAction={() => void load()} /><Field label="Mã handoff" value={values.handoffId} onChange={(value) => update('handoffId', value)} /><Action label="Mở hội thoại" onPress={() => void perform(async () => { const thread = await getHandoffThread(api, values.handoffId.trim()); Alert.alert(`Handoff ${thread.handoff.status}`, thread.messages.map((message) => `${message.role}: ${message.content}`).join('\n\n')); })} /><Field label="Nội dung trả lời" value={values.reply} onChange={(value) => update('reply', value)} multiline /><View style={styles.inline}><Action compact label="Nhận phiếu" onPress={() => void perform(() => claimHandoff(api, values.handoffId.trim()))} /><Action compact label="Gửi trả lời" onPress={() => void perform(() => replyToHandoff(api, values.handoffId.trim(), values.reply.trim()))} /><Action compact label="Đóng" onPress={() => void perform(() => resolveHandoff(api, values.handoffId.trim()))} /></View>{handoffs.map((item) => <Pressable key={item.id} onPress={() => update('handoffId', item.id)}><DataRow title={`${item.status} · ${item.reason}`} detail={`${item.lastQuestion ?? 'Chưa có câu hỏi'} · chờ ${Math.floor(item.waitingSeconds / 60)} phút · ${item.id}`} /></Pressable>)}</>}
        {section === 'knowledge' && <><SectionTitle title="Kho tri thức trợ lý" action="Làm mới" onAction={() => void load()} /><Field label="Tiêu đề" value={values.title} onChange={(value) => update('title', value)} /><Field label="Nội dung" value={values.content} onChange={(value) => update('content', value)} multiline /><Action label="Thêm tri thức" onPress={() => void perform(() => addKnowledgeChunk(api, { title: values.title.trim(), content: values.content.trim() }))} /><Field label="Câu hỏi thử" value={values.question} onChange={(value) => update('question', value)} /><Action label="Thử truy xuất" onPress={() => void perform(async () => setRetrieved(await previewKnowledge(api, values.question.trim())))} />{retrieved.map((item) => <DataRow key={item.id} title={`${item.used ? 'Được dùng' : 'Không dùng'} · ${item.title}`} detail={`${item.distance.toFixed(3)} · ${item.content}`} />)}{knowledge.map((item) => <View key={item.id} style={styles.row}><View style={styles.rowMain}><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.small}>{item.content}</Text></View><Action compact label="Xoá" onPress={() => void perform(() => deleteKnowledgeChunk(api, item.id))} /></View>)}</>}
        {section === 'rules' && <><SectionTitle title="Luật theo sự kiện" /><Field label="Event ID" value={values.eventId} onChange={(value) => update('eventId', value)} /><Action label="Tải luật" onPress={() => void perform(async () => setRules(await getEventRules(api, values.eventId.trim())), 'rules')} />{rules && <><Text style={styles.small}>{rules.eventTitle} · {rules.published ? 'Đang xuất bản' : 'Bản nháp'}</Text><Field label="Nội dung luật" value={values.content || rules.content} onChange={(value) => update('content', value)} multiline /><Action label="Lưu bản nháp" onPress={() => void perform(() => saveEventRules(api, rules.eventId, { eventTitle: rules.eventTitle, content: values.content || rules.content, published: false }), 'rules')} /><Action label="Xuất bản luật" onPress={() => void perform(() => saveEventRules(api, rules.eventId, { eventTitle: rules.eventTitle, content: values.content || rules.content, published: true }), 'rules')} /></>}</>}
        {section === 'templates' && <>
          <SectionTitle title="Mẫu sự kiện" action="Làm mới" onAction={() => void load()} />
          <Field label="Mã mẫu" value={values.slug} onChange={(value) => update('slug', value)} />
          <Field label="Tên mẫu" value={values.name} onChange={(value) => update('name', value)} />
          <Field label="Danh mục" value={values.title} onChange={(value) => update('title', value)} />
          <Field label="Mô tả" value={values.content} onChange={(value) => update('content', value)} multiline />
          <Action label="Tạo mẫu nháp" onPress={() => void perform(() => api.post('/v1/platform/concert-templates', { code: values.slug.trim(), name: values.name.trim(), category: values.title.trim(), description: values.content.trim() }))} />
          {templateRows.map((item, index) => {
            const id = String(item.id ?? index);
            const status = String(item.status ?? 'DRAFT').toLowerCase();
            return <View key={id} style={styles.row}><View style={styles.rowMain}><Pressable onPress={() => void api.get<Record<string, unknown>>(`/v1/platform/concert-templates/${id}`).then((response) => { setSelectedTemplateId(id); setTemplateDetail(response.data); setTemplateStageJson(JSON.stringify(response.data.stage ?? null, null, 2)); setTemplateZonesJson(JSON.stringify(response.data.zones ?? [], null, 2)); }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Không tải được mẫu.'))}><Text style={styles.rowTitle}>{String(item.name ?? item.code ?? 'Mẫu')} · {String(item.status ?? '')}</Text><Text style={styles.small}>{String(item.category ?? '')} · {String(item.capacity ?? 0)} chỗ · {id}</Text></Pressable></View><View style={styles.inline}><Action compact label="Mở" onPress={() => void perform(() => api.post(`/v1/platform/concert-templates/${id}/${status === 'active' ? 'archive' : 'activate'}`), 'templates')} /><Action compact label="Nháp" onPress={() => void perform(() => api.post(`/v1/platform/concert-templates/${id}/draft`), 'templates')} /></View></View>;
          })}
          {templateDetail && selectedTemplateId ? <>
            <SectionTitle title={`Chỉnh mẫu · ${String(templateDetail.name ?? '')}`} />
            <Field label="Tên" value={values.name || String(templateDetail.name ?? '')} onChange={(value) => update('name', value)} />
            <Field label="Danh mục" value={values.title || String(templateDetail.category ?? '')} onChange={(value) => update('title', value)} />
            <Field label="Mô tả" value={values.content || String(templateDetail.description ?? '')} onChange={(value) => update('content', value)} multiline />
            <Action label="Lưu thông tin mẫu" onPress={() => void perform(() => api.request(`/v1/platform/concert-templates/${selectedTemplateId}`, { method: 'PATCH', body: { name: values.name || templateDetail.name, category: values.title || templateDetail.category, description: values.content || templateDetail.description } }), 'templates')} />
            <Field label="Sân khấu JSON (null hoặc object)" value={templateStageJson} onChange={setTemplateStageJson} multiline />
            <Field label="Danh sách khu JSON" value={templateZonesJson} onChange={setTemplateZonesJson} multiline />
            <Action label="Lưu sân khấu và khu" onPress={() => void perform(async () => {
              const stage = JSON.parse(templateStageJson) as unknown;
              const zones = JSON.parse(templateZonesJson) as unknown;
              if (stage !== null && (typeof stage !== 'object' || Array.isArray(stage))) throw new Error('Sân khấu phải là object hoặc null.');
              if (!Array.isArray(zones)) throw new Error('Danh sách khu phải là JSON array.');
              await api.put(`/v1/platform/concert-templates/${selectedTemplateId}/zones`, { stage, zones });
            }, 'templates')} />
          </> : null}
        </>}
        {section === 'account' && <><SectionTitle title="Quyền truy cập" /><Text style={styles.muted}>Quyền được xác nhận từ /v1/me/permissions. Các API sẽ kiểm tra lại ở máy chủ.</Text>{permissions.map((permission) => <DataRow key={permission} title={permission} detail="Được cấp bởi backend" />)}<Action label="Đăng xuất" onPress={() => void signOut()} /></>}
      </ScrollView>
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) { return <View style={styles.center}>{children}</View>; }
function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) { return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text>{action && <Pressable onPress={onAction}><Text style={styles.link}>{action}</Text></Pressable>}</View>; }
function Field({ label, value, onChange, multiline = false }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean }) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} placeholderTextColor="#777783" multiline={multiline} autoCapitalize="none" style={[styles.input, multiline && styles.textarea]} /></View>; }
function Action({ label, onPress, compact = false }: { label: string; onPress: () => void; compact?: boolean }) { return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.action, compact && styles.actionCompact, pressed && styles.pressed]}><Text style={styles.actionText}>{label}</Text></Pressable>; }
function DataRow({ title, detail }: { title: string; detail: string }) { return <View style={styles.dataRow}><Text style={styles.rowTitle}>{title}</Text><Text selectable style={styles.small}>{detail}</Text></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#15151C', paddingTop: 56 },
  topbar: { minHeight: 62, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: '#A5A5B0', fontSize: 10, fontWeight: '800', letterSpacing: 1.3 },
  heading: { color: '#F6F4FA', fontSize: 23, fontWeight: '800', marginTop: 5 },
  iconButton: { width: 42, height: 42, borderRadius: 8, backgroundColor: '#2A2933', alignItems: 'center', justifyContent: 'center' },
  iconText: { color: '#F6F4FA', fontSize: 21 },
  tabs: { paddingHorizontal: 14, gap: 7, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#33323D' },
  tab: { minHeight: 38, paddingHorizontal: 13, justifyContent: 'center', borderRadius: 7, backgroundColor: '#22212A' },
  tabActive: { backgroundColor: '#C8B5FF' },
  tabText: { color: '#D0CED8', fontSize: 12, fontWeight: '700' },
  tabTextActive: { color: '#211A35' },
  content: { padding: 18, paddingBottom: 60, gap: 11 },
  sectionHeader: { minHeight: 38, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  sectionTitle: { color: '#F6F4FA', fontSize: 18, fontWeight: '800' },
  link: { color: '#C8B5FF', fontSize: 13, fontWeight: '700' },
  field: { gap: 6 }, label: { color: '#B5B3BE', fontSize: 11, fontWeight: '700' },
  input: { minHeight: 44, borderRadius: 7, borderWidth: 1, borderColor: '#44434E', backgroundColor: '#201F27', color: '#F6F4FA', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  action: { minHeight: 43, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', borderRadius: 7, backgroundColor: '#C8B5FF', alignSelf: 'flex-start' },
  actionCompact: { minHeight: 34, paddingHorizontal: 10 },
  actionText: { color: '#211A35', fontSize: 12, fontWeight: '800' }, pressed: { opacity: 0.72 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderWidth: 1, borderColor: '#33323D', borderRadius: 7, gap: 10 },
  rowMain: { flex: 1, gap: 4 }, rowTitle: { color: '#F6F4FA', fontSize: 14, fontWeight: '700' },
  small: { color: '#AAA8B3', fontSize: 11, lineHeight: 16 }, mono: { color: '#8F8D98', fontSize: 10 },
  inline: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  dataRow: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#33323D', gap: 4 },
  panel: { padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#44434E', backgroundColor: '#201F27', gap: 10 },
  metric: { color: '#F6F4FA', fontSize: 17, fontWeight: '700' },
  error: { color: '#FF9292', fontSize: 12, padding: 11, backgroundColor: '#3A2025', borderRadius: 7 },
  login: { flexGrow: 1, justifyContent: 'center', gap: 16, padding: 26, backgroundColor: '#15151C' },
  title: { color: '#F6F4FA', fontSize: 32, fontWeight: '900' }, muted: { color: '#B5B3BE', fontSize: 14, lineHeight: 21 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#15151C' },
});