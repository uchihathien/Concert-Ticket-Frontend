import {
  ApiError,
  configureVenueZones,
  floorPlanRect,
  floorPlanViewBox,
  listVenues,
  outlinePath,
  previewFloorPlan,
  type AdminVenue,
  type ConfigureZonesRequest,
  type FloorPlan,
  type LayoutShape,
  type StageShape,
  type ZoneInput,
} from '@nexaticket/ts-sdk';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { api } from '@/lib/api';

const STAGE_SHAPES: { value: StageShape; label: string }[] = [
  { value: 'RECTANGLE', label: 'Hộp chữ nhật' },
  { value: 'CIRCLE', label: 'Tròn giữa' },
  { value: 'THRUST', label: 'Nhô ra (chữ U)' },
];
const LAYOUT_SHAPES: { value: LayoutShape; label: string }[] = [
  { value: 'GRID', label: 'Khối chữ nhật' },
  { value: 'ARC', label: 'Cung tròn' },
];
const CANVAS_HEIGHT = 300;

/**
 * Sửa sơ đồ khán phòng — bản app của FloorPlanEditor trên web Tổ chức.
 *
 * Giống web ở điểm cốt lõi: app KHÔNG tự tính toạ độ nào. Mọi hình vẽ đến từ
 * `…/floor-plan/preview` của backend — cùng phép tính chạy lúc mở bán — nên sơ đồ ở đây, trên web
 * và ở màn khách chọn chỗ là một.
 *
 * Khác web ở cách thao tác: không có chuột, nên CHỌN khu bằng một chạm rồi KÉO bất kỳ đâu trên sơ
 * đồ để dời khu đang chọn (ngón tay to hơn một khu nhỏ — bắt chạm đúng mép khu mới kéo được thì
 * không dùng nổi). Mũi tên ±0,5 cho chỉnh tinh; góc và bán kính nhập bằng số như web.
 */
export default function FloorPlanScreen() {
  const params = useLocalSearchParams<{ organizationId?: string; venueId?: string }>();
  const organizationId = String(params.organizationId ?? '');
  const venueId = String(params.venueId ?? '');

  const [venue, setVenue] = useState<AdminVenue | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ConfigureZonesRequest | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<FloorPlan | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  // Đang kéo khu trên sơ đồ thì khoá cuộn trang — nếu không, ngón tay kéo khu cũng kéo cả màn đi.
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let active = true;
    listVenues(api, organizationId)
      .then((rows) => {
        if (!active) return;
        const found = rows.find((row) => row.id === venueId) ?? null;
        if (!found) {
          setLoadError('Không tìm thấy địa điểm.');
          return;
        }
        setVenue(found);
        setDraft(initialDraft(found));
        setSelected(found.zones[0]?.zoneCode ?? null);
      })
      .catch(() => { if (active) setLoadError('Không tải được địa điểm.'); });
    return () => { active = false; };
  }, [organizationId, venueId]);

  // Xem trước chậm một nhịp: kéo một khu bắn ra hàng chục lần cập nhật — mỗi lần là một lời gọi mạng nếu không chờ.
  useEffect(() => {
    if (!draft) return;
    let active = true;
    const timer = setTimeout(() => {
      previewFloorPlan(api, organizationId, venueId, draft)
        .then((plan) => {
          if (!active) return;
          setPreview(plan);
          setPreviewError(null);
        })
        .catch((cause: unknown) => {
          // 422 gần như luôn là bản nháp chưa hợp lệ (cung thiếu bán kính, góc ngược) — thông báo
          // của backend nói đúng chỗ sai, nên hiện nguyên văn như web.
          if (active) setPreviewError(cause instanceof ApiError && cause.detail ? cause.detail : 'Không dựng được bản xem trước.');
        });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [draft, organizationId, venueId]);

  const zone = draft?.zones.find((item) => item.zoneCode === selected) ?? null;

  function patchZone(zoneCode: string, patch: Partial<ZoneInput>) {
    setDraft((current) => current && { ...current, zones: current.zones.map((item) => (item.zoneCode === zoneCode ? { ...item, ...patch } : item)) });
  }

  /** Dời khu: ghim bằng bố cục ĐÃ GIẢI của bản xem trước, để khu đang tự xếp không nhảy về gốc toạ độ. */
  function moveZone(zoneCode: string, originX: number, originY: number) {
    const solved = preview?.zones.find((item) => item.zoneCode === zoneCode)?.layout;
    const current = draft?.zones.find((item) => item.zoneCode === zoneCode)?.layout;
    const base = current ?? solved;
    if (!base) return;
    patchZone(zoneCode, {
      layout: {
        shape: base.shape as LayoutShape,
        originX: round(originX),
        originY: round(originY),
        rotationDeg: base.rotationDeg ?? undefined,
        innerRadius: base.innerRadius ?? undefined,
        startAngleDeg: base.startAngleDeg ?? undefined,
        endAngleDeg: base.endAngleDeg ?? undefined,
      },
    });
  }

  function nudge(dx: number, dy: number) {
    if (!selected) return;
    const layout = zone?.layout ?? preview?.zones.find((item) => item.zoneCode === selected)?.layout;
    if (!layout) return;
    moveZone(selected, layout.originX + dx, layout.originY + dy);
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setMessage(null);
    try {
      await configureVenueZones(api, organizationId, venueId, draft);
      setMessage({ tone: 'ok', text: 'Đã lưu sơ đồ.' });
    } catch (cause) {
      setMessage({ tone: 'error', text: cause instanceof ApiError && cause.detail ? cause.detail : 'Không lưu được sơ đồ. Thử lại sau.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" hitSlop={8} onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.brand}>NEXATICKET / ORGANIZER</Text>
          <Text numberOfLines={1} style={styles.headerTitle}>Sửa sơ đồ{venue ? ` · ${venue.name}` : ''}</Text>
        </View>
      </View>

      {loadError ? (
        <View style={styles.state}><Text style={styles.error}>{loadError}</Text></View>
      ) : !draft ? (
        <View style={styles.center}><ActivityIndicator color="#D5FF66" /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" scrollEnabled={!dragging}>
          <View style={styles.canvasBox}>
            {preview ? (
              <PlanCanvas plan={preview} selected={selected} onSelect={setSelected} onMove={moveZone} onDragChange={setDragging} />
            ) : previewError ? null : (
              <View style={[styles.center, { height: CANVAS_HEIGHT }]}><ActivityIndicator color="#D5FF66" /></View>
            )}
            {previewError ? <Text style={[styles.error, { padding: 12 }]}>{previewError}</Text> : null}
          </View>
          <Text style={styles.hint}>Chạm một khu để chọn, rồi kéo trên sơ đồ để dời khu đó. Mũi tên bên dưới chỉnh từng 0,5.</Text>

          <View style={styles.nudgeRow}>
            <NudgeButton label="←" onPress={() => nudge(-0.5, 0)} />
            <NudgeButton label="↑" onPress={() => nudge(0, -0.5)} />
            <NudgeButton label="↓" onPress={() => nudge(0, 0.5)} />
            <NudgeButton label="→" onPress={() => nudge(0.5, 0)} />
          </View>

          <Section title="SÂN KHẤU">
            <Choices
              options={STAGE_SHAPES}
              value={draft.stage?.shape ?? 'RECTANGLE'}
              onChange={(shape) => setDraft((current) => current && { ...current, stage: { x: 0, y: 0, width: 12, height: 4, ...current.stage, shape } })}
            />
            <View style={styles.pair}>
              <NumberField label="Ngang (x)" value={draft.stage?.x ?? 0} onChange={(x) => setDraft((c) => c && { ...c, stage: { shape: 'RECTANGLE', y: 0, width: 12, height: 4, ...c.stage, x } })} />
              <NumberField label="Dọc (y)" value={draft.stage?.y ?? 0} onChange={(y) => setDraft((c) => c && { ...c, stage: { shape: 'RECTANGLE', x: 0, width: 12, height: 4, ...c.stage, y } })} />
            </View>
            <View style={styles.pair}>
              <NumberField label={draft.stage?.shape === 'CIRCLE' ? 'Đường kính' : 'Chiều rộng'} value={draft.stage?.width ?? 12} onChange={(width) => setDraft((c) => c && { ...c, stage: { shape: 'RECTANGLE', x: 0, y: 0, height: 4, ...c.stage, width } })} />
              {draft.stage?.shape === 'CIRCLE' ? <View style={{ flex: 1 }} /> : (
                <NumberField label="Chiều sâu" value={draft.stage?.height ?? 4} onChange={(height) => setDraft((c) => c && { ...c, stage: { shape: 'RECTANGLE', x: 0, y: 0, width: 12, ...c.stage, height } })} />
              )}
            </View>
          </Section>

          <Section title="KHU VỰC">
            <View style={styles.zoneTabs}>
              {draft.zones.map((item) => (
                <Pressable key={item.zoneCode} accessibilityRole="button" accessibilityState={{ selected: item.zoneCode === selected }} onPress={() => setSelected(item.zoneCode)} style={[styles.zoneTab, item.zoneCode === selected && styles.zoneTabOn]}>
                  <Text style={[styles.zoneTabText, item.zoneCode === selected && styles.zoneTabTextOn]}>{item.zoneCode}</Text>
                </Pressable>
              ))}
            </View>
            {zone ? <ZoneControls zone={zone} onChange={(patch) => patchZone(zone.zoneCode, patch)} /> : null}
          </Section>

          {message ? <Text style={message.tone === 'ok' ? styles.ok : styles.error}>{message.text}</Text> : null}
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" disabled={saving} onPress={() => void save()} style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed, saving && styles.disabled]}>
              <Text style={styles.primaryText}>{saving ? 'ĐANG LƯU...' : 'LƯU SƠ ĐỒ'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => { if (venue) { setDraft(initialDraft(venue)); setMessage(null); } }} style={styles.secondary}>
              <Text style={styles.secondaryText}>VỀ NHƯ CŨ</Text>
            </Pressable>
          </View>
          <Text style={styles.warning}>
            Lưu sơ đồ sẽ bị từ chối nếu địa điểm này đã có sự kiện từng lên bán — tồn kho đã dựng theo đúng những mã khu hiện tại. Rút sự kiện xuống trước.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function PlanCanvas({ plan, selected, onSelect, onMove, onDragChange }: { plan: FloorPlan; selected: string | null; onSelect: (code: string) => void; onMove: (code: string, x: number, y: number) => void; onDragChange: (dragging: boolean) => void }) {
  const rect = useMemo(() => floorPlanRect(plan.bounds), [plan.bounds]);
  const [size, setSize] = useState({ width: 1, height: CANVAS_HEIGHT });
  // Điểm bắt đầu kéo — chỉ đọc/ghi trong handler cử chỉ, không trong lúc render.
  const drag = useRef<{ code: string; startX: number; startY: number; originX: number; originY: number } | null>(null);
  // Sơ đồ vẽ kiểu "meet": tỷ lệ là cạnh bị giới hạn.
  const scale = Math.min(size.width / rect.width, size.height / rect.height);

  const endDrag = () => {
    drag.current = null;
    onDragChange(false);
  };

  const stage = plan.stage;
  return (
    <View
      style={{ height: CANVAS_HEIGHT }}
      onLayout={(event) => setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
      // Chạm (không di chuyển) để lọt xuống khu trên sơ đồ — chọn khu. Chỉ khi ngón tay DI CHUYỂN và
      // đã có khu được chọn, khung mới nhận cử chỉ để kéo khu đó.
      onStartShouldSetResponder={() => false}
      onMoveShouldSetResponder={() => selected !== null}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(event) => {
        const layout = plan.zones.find((item) => item.zoneCode === selected)?.layout;
        if (!selected || !layout) return;
        drag.current = { code: selected, startX: event.nativeEvent.pageX, startY: event.nativeEvent.pageY, originX: layout.originX, originY: layout.originY };
        onDragChange(true);
      }}
      onResponderMove={(event) => {
        const d = drag.current;
        if (!d) return;
        onMove(d.code, d.originX + (event.nativeEvent.pageX - d.startX) / scale, d.originY + (event.nativeEvent.pageY - d.startY) / scale);
      }}
      onResponderRelease={endDrag}
      onResponderTerminate={endDrag}
    >
      <Svg width="100%" height="100%" viewBox={floorPlanViewBox(rect)}>
        <G>
          {stage.shape === 'CIRCLE' ? (
            <Circle cx={stage.x} cy={stage.y} r={stage.width / 2} fill="#26342A" stroke="#3B493F" strokeWidth={0.2} />
          ) : (
            <Rect x={stage.x - stage.width / 2} y={stage.y - stage.height / 2} width={stage.width} height={stage.height} rx={stage.shape === 'THRUST' ? Math.min(stage.width, stage.height) / 2 : 0.6} fill="#26342A" stroke="#3B493F" strokeWidth={0.2} />
          )}
          <SvgText x={stage.x} y={stage.y} fill="#A6B1A8" fontSize={1.2} fontWeight="bold" textAnchor="middle" alignmentBaseline="middle">SÂN KHẤU</SvgText>
        </G>
        {plan.zones.map((z) => {
          const on = z.zoneCode === selected;
          const xs = z.outline.map((p) => p.x);
          const ys = z.outline.map((p) => p.y);
          const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
          const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
          return (
            <G key={z.zoneCode} onPress={() => onSelect(z.zoneCode)}>
              <Path
                d={outlinePath(z.outline)}
                fill={on ? 'rgba(213,255,102,0.28)' : z.kind === 'STANDING' ? 'rgba(213,255,102,0.10)' : '#1F2A22'}
                stroke={on ? '#D5FF66' : '#4A5A4E'}
                strokeWidth={on ? 0.35 : 0.2}
              />
              <SvgText x={cx} y={cy} fill={on ? '#D5FF66' : '#F1F5F1'} fontSize={1.4} fontWeight="bold" textAnchor="middle" alignmentBaseline="middle">{z.zoneCode}</SvgText>
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

function ZoneControls({ zone, onChange }: { zone: ZoneInput; onChange: (patch: Partial<ZoneInput>) => void }) {
  const layout = zone.layout;
  const arc = layout?.shape === 'ARC';
  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.muted}>
        {zone.name} · {zone.kind === 'SEATED' ? `${zone.rowCount} hàng × ${zone.seatsPerRow} ghế` : `${zone.capacity} chỗ đứng`}
      </Text>
      <Choices
        options={LAYOUT_SHAPES}
        value={layout?.shape ?? 'GRID'}
        onChange={(shape) =>
          onChange({
            layout: {
              shape,
              originX: layout?.originX ?? 0,
              originY: layout?.originY ?? 0,
              ...(shape === 'ARC' ? { innerRadius: layout?.innerRadius ?? 12, startAngleDeg: 20, endAngleDeg: 160 } : { rotationDeg: layout?.rotationDeg ?? 0 }),
            },
          })
        }
      />
      {layout ? (
        <>
          <View style={styles.pair}>
            <NumberField label="Ngang (x)" value={layout.originX} onChange={(originX) => onChange({ layout: { ...layout, originX } })} />
            <NumberField label="Dọc (y)" value={layout.originY} onChange={(originY) => onChange({ layout: { ...layout, originY } })} />
          </View>
          {arc ? (
            <>
              <NumberField label="Bán kính hàng đầu" value={layout.innerRadius ?? 12} onChange={(innerRadius) => onChange({ layout: { ...layout, innerRadius } })} />
              <View style={styles.pair}>
                <NumberField label="Góc bắt đầu (°)" value={layout.startAngleDeg ?? 20} onChange={(startAngleDeg) => onChange({ layout: { ...layout, startAngleDeg } })} />
                <NumberField label="Góc kết thúc (°)" value={layout.endAngleDeg ?? 160} onChange={(endAngleDeg) => onChange({ layout: { ...layout, endAngleDeg } })} />
              </View>
              <Text style={styles.hint}>0° là hướng sang phải, góc tăng theo chiều kim đồng hồ. Khán đài trước sân khấu thường trong khoảng 20°–160°.</Text>
            </>
          ) : (
            <NumberField label="Xoay (°)" value={layout.rotationDeg ?? 0} onChange={(rotationDeg) => onChange({ layout: { ...layout, rotationDeg } })} />
          )}
          <Pressable accessibilityRole="button" onPress={() => onChange({ layout: undefined })} style={styles.secondary}>
            <Text style={styles.secondaryText}>ĐỂ HỆ THỐNG TỰ XẾP</Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.hint}>Khu này đang được hệ thống tự xếp xuống dưới sân khấu. Kéo nó trên sơ đồ để đặt chỗ cố định.</Text>
      )}
    </View>
  );
}

/** Ô số: giữ chuỗi đang gõ riêng, để gõ "-" hoặc "12." không bị ô tự xoá giữa chừng. */
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);
  const shown = focused ? text : String(value);
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={shown}
        keyboardType="numbers-and-punctuation"
        onFocus={() => { setText(String(value)); setFocused(true); }}
        onBlur={() => setFocused(false)}
        onChangeText={(next) => {
          setText(next);
          const parsed = Number(next.replace(',', '.'));
          if (next.trim() !== '' && !Number.isNaN(parsed)) onChange(parsed);
        }}
        style={styles.input}
      />
    </View>
  );
}

function Choices<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return (
    <View style={styles.choices}>
      {options.map((option) => (
        <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected: option.value === value }} onPress={() => onChange(option.value)} style={[styles.choice, option.value === value && styles.choiceOn]}>
          <Text style={[styles.choiceText, option.value === value && styles.choiceTextOn]}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function NudgeButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Dời khu ${label}`} onPress={onPress} style={({ pressed }) => [styles.nudge, pressed && styles.nudgePressed]}>
      <Text style={styles.nudgeText}>{label}</Text>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeading}>{title}</Text>
      {children}
    </View>
  );
}

function initialDraft(venue: AdminVenue): ConfigureZonesRequest {
  return {
    stage: venue.stage ? { shape: venue.stage.shape as StageShape, x: venue.stage.x, y: venue.stage.y, width: venue.stage.width, height: venue.stage.height } : undefined,
    zones: venue.zones.map((zone, index) => ({
      zoneCode: zone.zoneCode,
      name: zone.name,
      kind: zone.kind as 'SEATED' | 'STANDING',
      rowCount: zone.rowCount ?? undefined,
      seatsPerRow: zone.seatsPerRow ?? undefined,
      capacity: zone.capacity ?? undefined,
      sortOrder: index,
      layout: zone.layout
        ? {
            shape: zone.layout.shape as LayoutShape,
            originX: zone.layout.originX,
            originY: zone.layout.originY,
            rotationDeg: zone.layout.rotationDeg ?? undefined,
            innerRadius: zone.layout.innerRadius ?? undefined,
            startAngleDeg: zone.layout.startAngleDeg ?? undefined,
            endAngleDeg: zone.layout.endAngleDeg ?? undefined,
          }
        : undefined,
    })),
  };
}

const round = (value: number) => Math.round(value * 2) / 2;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111713' },
  header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#28342B' },
  back: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#F1F5F1', fontSize: 32, lineHeight: 36 },
  brand: { color: '#D5FF66', fontSize: 11, fontWeight: '900', letterSpacing: 1.3 },
  headerTitle: { color: '#F1F5F1', fontSize: 18, fontWeight: '900', marginTop: 4 },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  state: { margin: 16, padding: 16, borderRadius: 8, backgroundColor: '#19221B' },
  canvasBox: { borderRadius: 10, borderWidth: 1, borderColor: '#344238', backgroundColor: '#151D17', overflow: 'hidden' },
  hint: { color: '#A6B1A8', fontSize: 12, lineHeight: 18 },
  nudgeRow: { flexDirection: 'row', gap: 8 },
  nudge: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#3B493F', backgroundColor: '#19221B' },
  nudgePressed: { borderColor: '#D5FF66', backgroundColor: '#212C23' },
  nudgeText: { color: '#D5FF66', fontSize: 20, fontWeight: '900' },
  section: { padding: 14, gap: 10, borderRadius: 8, borderWidth: 1, borderColor: '#344238', backgroundColor: '#19221B' },
  sectionHeading: { color: '#D5FF66', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  pair: { flexDirection: 'row', gap: 10 },
  fieldLabel: { color: '#AEB9B0', fontSize: 13, fontWeight: '700' },
  input: { minHeight: 43, paddingHorizontal: 11, borderWidth: 1, borderColor: '#3B493F', borderRadius: 7, color: '#F1F5F1', backgroundColor: '#151D17', fontSize: 15 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  choice: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 7, borderWidth: 1, borderColor: '#3B493F' },
  choiceOn: { backgroundColor: '#D5FF66', borderColor: '#D5FF66' },
  choiceText: { color: '#C4CEC5', fontSize: 13, fontWeight: '700' },
  choiceTextOn: { color: '#17210D' },
  zoneTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  zoneTab: { minWidth: 48, minHeight: 36, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderRadius: 7, borderWidth: 1, borderColor: '#3B493F' },
  zoneTabOn: { borderColor: '#D5FF66', backgroundColor: '#26342A' },
  zoneTabText: { color: '#C4CEC5', fontSize: 13, fontWeight: '800' },
  zoneTabTextOn: { color: '#D5FF66' },
  muted: { color: '#A6B1A8', fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', gap: 10 },
  primary: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 7, backgroundColor: '#D5FF66' },
  primaryPressed: { backgroundColor: '#C4F04F' },
  primaryText: { color: '#17210D', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 7, borderWidth: 1, borderColor: '#3B493F' },
  secondaryText: { color: '#C4CEC5', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  disabled: { opacity: 0.5 },
  ok: { color: '#5DD39E', fontSize: 13, fontWeight: '700' },
  error: { color: '#FF8C79', fontSize: 13, lineHeight: 19 },
  warning: { color: '#FFD36B', fontSize: 12, lineHeight: 18 },
});
