import {
  ApiError,
  fetchSeatMap,
  getPublicFloorPlan,
  newIdempotencyKey,
  placeHold,
  placeOrder,
  seatPositionsFitFloorPlan,
  type FloorPlan,
  type HoldCreated,
  type SeatMap,
  type StandingLine,
} from '@nexaticket/ts-sdk';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Ellipse, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, publicApi } from '@/lib/api';
import { useMobileAuth } from '@/lib/auth-context';
import { resolveMediaUrl } from '@/lib/media-url';

interface ZoneOffer {
  zoneCode: string;
  name: string;
  kind: 'SEATED' | 'STANDING';
  priceVnd: number;
  available: number;
}

interface KeyForSelection {
  signature: string;
  key: string;
}

export default function BookingScreen() {
  const { sessionId, eventSlug, eventTitle, seatMapImageUrl } = useLocalSearchParams<{
    sessionId: string;
    eventSlug: string;
    eventTitle: string;
    seatMapImageUrl?: string;
  }>();
  const { signedIn } = useMobileAuth();
  const [snapshot, setSnapshot] = useState<{ data: SeatMap; etag: string | null } | null>(null);
  const [floorPlan, setFloorPlan] = useState<FloorPlan | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const holdKey = useRef<KeyForSelection | null>(null);
  const orderKey = useRef<KeyForSelection | null>(null);
  const pendingHold = useRef<{ signature: string; result: HoldCreated } | null>(null);

  useEffect(() => {
    let active = true;
    let requesting = false;
    let previous: typeof snapshot = null;

    const load = async () => {
      if (requesting) return;
      requesting = true;
      try {
        const fresh = await fetchSeatMap(publicApi, sessionId, previous);
        previous = fresh;
        if (active) {
          setSnapshot(fresh);
          setMapError(false);
        }
      } catch {
        if (active && !previous) setMapError(true);
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
  }, [sessionId, reload]);

  useEffect(() => {
    let active = true;
    getPublicFloorPlan(publicApi, eventSlug)
      .then((plan) => {
        if (active) setFloorPlan(plan);
      })
      .catch(() => {
        if (active) setFloorPlan(null);
      });
    return () => {
      active = false;
    };
  }, [eventSlug]);

  const map = snapshot?.data ?? null;
  const offers = buildOffers(map, floorPlan);
  const picked = offers.filter((offer) => (quantities[offer.zoneCode] ?? 0) > 0);
  const unitCount = picked.reduce((sum, offer) => sum + quantities[offer.zoneCode], 0);
  const total = picked.reduce(
    (sum, offer) => sum + offer.priceVnd * quantities[offer.zoneCode],
    0,
  );
  const allowance = map?.purchaseAllowance ?? null;
  const overAllowance = allowance !== null && unitCount > allowance.remaining;
  const positions = new Map(
    (map?.seats ?? [])
      .filter((seat) => seat.posX !== null && seat.posY !== null)
      .map((seat) => [seat.seatCode, { x: seat.posX as number, y: seat.posY as number }]),
  );
  const canDrawFloorPlan = Boolean(
    floorPlan && positions.size > 0 && seatPositionsFitFloorPlan(floorPlan, positions),
  );

  function updateQuantity(zoneCode: string, value: number) {
    setFailure(null);
    setQuantities((current) => ({ ...current, [zoneCode]: Math.max(0, value) }));
  }

  async function submit() {
    if (!signedIn) {
      router.push('/login');
      return;
    }
    if (!map || unitCount === 0 || overAllowance || !acceptedTerms || submitting) return;

    setSubmitting(true);
    setFailure(null);
    const signature = JSON.stringify({ sessionId, quantities });
    const holdIdempotencyKey = getKey(holdKey, signature);
    const orderIdempotencyKey = getKey(orderKey, signature);
    const seatedZones: StandingLine[] = picked
      .filter((offer) => offer.kind === 'SEATED')
      .map((offer) => ({ zoneCode: offer.zoneCode, quantity: quantities[offer.zoneCode] }));
    const standing: StandingLine[] = picked
      .filter((offer) => offer.kind === 'STANDING')
      .map((offer) => ({ zoneCode: offer.zoneCode, quantity: quantities[offer.zoneCode] }));

    let hold = pendingHold.current?.signature === signature ? pendingHold.current.result : null;
    if (!hold) {
      try {
        hold = await placeHold(
          api,
          sessionId,
          {
            seatedZones: seatedZones.length ? seatedZones : undefined,
            standing: standing.length ? standing : undefined,
          },
          holdIdempotencyKey,
        );
        pendingHold.current = { signature, result: hold };
      } catch (error) {
        holdKey.current = null;
        orderKey.current = null;
        setFailure(errorMessage(error));
        setReload((value) => value + 1);
        setSubmitting(false);
        return;
      }
    }

    try {
      const order = await placeOrder(api, { holdId: hold.holdId }, orderIdempotencyKey);
      pendingHold.current = null;
      router.replace({
        pathname: '/checkout/[orderId]',
        params: {
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          checkoutUrl: order.checkoutUrl ?? '',
          paymentReference: order.paymentReference,
          totalVnd: String(order.totalVnd),
        },
      });
    } catch (error) {
      // Server đã trả lời dứt khoát: saga checkout đã bù trừ và hold ở trạng thái CONVERTED, dùng lại
      // chỉ nhận HOLD_EXPIRED. Lần bấm sau phải giữ chỗ mới. Mất mạng/timeout thì giữ nguyên khoá để
      // thử lại idempotent, vì không biết server đã xử lý hay chưa.
      if (error instanceof ApiError && error.status > 0) {
        pendingHold.current = null;
        holdKey.current = null;
        orderKey.current = null;
        setReload((value) => value + 1);
      }
      setFailure(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !map) {
    return (
      <SafeAreaView style={styles.screen}>
        <Header title={eventTitle} />
        <View style={styles.centerState}>
          <ActivityIndicator color="#D5FF66" size="large" />
          <Text style={styles.muted}>Đang tải tình trạng chỗ...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (mapError || !map) {
    return (
      <SafeAreaView style={styles.screen}>
        <Header title={eventTitle} />
        <View style={styles.centerState}>
          <Text style={styles.sectionTitle}>Không tải được sơ đồ chỗ</Text>
          <Pressable onPress={() => { setLoading(true); setReload((value) => value + 1); }} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Thử lại</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Header title={eventTitle} />
      <FlatList
        data={offers}
        keyExtractor={(offer) => offer.zoneCode}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {!signedIn ? (
              <View style={styles.signInNotice}>
                <Text style={styles.noticeText}>Đăng nhập để giữ chỗ và thanh toán.</Text>
                <Link href="/login" asChild>
                  <Pressable><Text style={styles.noticeLink}>Đăng nhập</Text></Pressable>
                </Link>
              </View>
            ) : null}
            <View style={styles.intro}>
              <Text style={styles.eyebrow}>CHỌN KHU VỰC</Text>
              <Text style={styles.sectionTitle}>Sơ đồ khán phòng</Text>
              <Text style={styles.muted}>Sơ đồ để xem vị trí; chọn khu và số vé bên dưới.</Text>
            </View>
            {seatMapImageUrl ? (
              <Image source={{ uri: resolveMediaUrl(seatMapImageUrl) }} resizeMode="contain" style={styles.mapImage} />
            ) : canDrawFloorPlan && floorPlan ? (
              <FloorPlanPreview plan={floorPlan} seats={map.seats} />
            ) : (
              <View style={styles.mapFallback}>
                <Text style={styles.fallbackTitle}>Sơ đồ đang được cập nhật</Text>
                <Text style={styles.muted}>Các khu và tình trạng chỗ bên dưới vẫn được cập nhật trực tiếp.</Text>
              </View>
            )}
            <View style={styles.legend}>
              <Legend color="#3FAE74" label="Còn chỗ" />
              <Legend color="#5E6B62" label="Đã giữ" />
              <Legend color="#2B352E" label="Đã bán" />
            </View>
            <View style={styles.zoneHeading}>
              <Text style={styles.sectionTitle}>Chọn khu và số vé</Text>
              <Text style={styles.muted}>Cập nhật mỗi 5 giây</Text>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <ZoneCard
            offer={item}
            quantity={quantities[item.zoneCode] ?? 0}
            onChange={(value) => updateQuantity(item.zoneCode, value)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.mapFallback}>
            <Text style={styles.muted}>Suất diễn chưa có hạng vé nào để chọn.</Text>
          </View>
        }
        ListFooterComponent={
          <>
            {allowance ? <Text style={styles.allowance}>Bạn còn mua được {allowance.remaining} vé cho suất này.</Text> : null}
            {failure ? <Text accessibilityRole="alert" style={styles.failure}>{failure}</Text> : null}
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acceptedTerms }}
              onPress={() => setAcceptedTerms((value) => !value)}
              style={styles.terms}>
              <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
                {acceptedTerms ? <Text style={styles.checkmark}>✓</Text> : null}
              </View>
              <Text style={styles.termsText}>Tôi đồng ý với điều khoản mua vé và chính sách hoàn/đổi.</Text>
            </Pressable>
          </>
        }
      />
      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.muted}>{unitCount} vé đã chọn</Text>
          <Text style={styles.total}>{formatPrice(total)}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={signedIn && (unitCount === 0 || overAllowance || !acceptedTerms || submitting)}
          onPress={() => void submit()}
          style={[styles.primaryButton, signedIn && (unitCount === 0 || overAllowance || !acceptedTerms || submitting) && styles.buttonDisabled]}>
          <Text style={styles.primaryButtonText}>{submitting ? 'Đang giữ chỗ...' : signedIn ? 'Giữ chỗ & thanh toán' : 'Đăng nhập để tiếp tục'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Header({ title }: { title: string }) {
  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backGlyph}>‹</Text>
      </Pressable>
      <Text numberOfLines={1} style={styles.headerTitle}>{title}</Text>
      <View style={styles.backButton} />
    </View>
  );
}

function FloorPlanPreview({ plan, seats }: { plan: FloorPlan; seats: SeatMap['seats'] }) {
  const { bounds, stage, zones } = plan;
  const inset = 2;
  const viewBox = `${bounds.minX - inset} ${bounds.minY - inset} ${bounds.maxX - bounds.minX + inset * 2} ${bounds.maxY - bounds.minY + inset * 2}`;
  const colors: Record<string, string> = {
    AVAILABLE: '#3FAE74',
    HELD: '#5E6B62',
    RESERVED: '#D99A00',
    SOLD: '#2B352E',
    BLOCKED: '#1B231E',
  };

  return (
    <View style={styles.planFrame}>
      <Svg width="100%" height={230} viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
        {stage.shape === 'CIRCLE' ? (
          <Ellipse cx={stage.x + stage.width / 2} cy={stage.y + stage.height / 2} rx={stage.width / 2} ry={stage.height / 2} fill="#3B493F" />
        ) : stage.shape === 'THRUST' ? (
          <Path d={`M ${stage.x} ${stage.y} L ${stage.x + stage.width} ${stage.y} L ${stage.x + stage.width * 0.78} ${stage.y + stage.height} L ${stage.x + stage.width * 0.22} ${stage.y + stage.height} Z`} fill="#3B493F" />
        ) : (
          <Rect x={stage.x} y={stage.y} width={stage.width} height={stage.height} rx={0.5} fill="#3B493F" />
        )}
        <SvgText x={stage.x + stage.width / 2} y={stage.y + stage.height / 2} textAnchor="middle" alignmentBaseline="middle" fill="#F1F5F1" fontSize={1.1} fontWeight="700">SÂN KHẤU</SvgText>
        {zones.map((zone) => (
          <Polygon
            key={zone.zoneCode}
            points={zone.outline.map((point) => `${point.x},${point.y}`).join(' ')}
            fill="#1F2A22"
            fillOpacity={0.82}
            stroke="#87938A"
            strokeWidth={0.18}
          />
        ))}
        {seats.map((seat) => seat.posX !== null && seat.posY !== null ? (
          <Circle key={seat.id} cx={seat.posX} cy={seat.posY} r={0.22} fill={colors[seat.status] ?? '#5E6B62'} />
        ) : null)}
      </Svg>
      <Text style={styles.planCaption}>{plan.venueName}</Text>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function ZoneCard({ offer, quantity, onChange }: { offer: ZoneOffer; quantity: number; onChange: (value: number) => void }) {
  return (
    <View style={[styles.zoneCard, quantity > 0 && styles.zoneCardSelected]}>
      <View style={styles.zoneInfo}>
        <Text style={styles.zoneName}>{offer.name}</Text>
        <Text style={styles.zoneMeta}>
          {offer.available > 0 ? `Còn ${offer.available} ${offer.kind === 'SEATED' ? 'ghế' : 'chỗ'}` : 'Đã hết chỗ'}
          {offer.kind === 'STANDING' ? ' · vé đứng' : ''}
        </Text>
        <Text style={styles.zonePrice}>{formatPrice(offer.priceVnd)}</Text>
      </View>
      <View style={styles.quantityControl}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Bớt vé khu ${offer.name}`} disabled={quantity === 0} onPress={() => onChange(quantity - 1)} style={[styles.stepper, quantity === 0 && styles.stepperDisabled]}>
          <Text style={styles.stepperText}>−</Text>
        </Pressable>
        <Text style={styles.quantity}>{quantity}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Thêm vé khu ${offer.name}`} disabled={quantity >= offer.available} onPress={() => onChange(quantity + 1)} style={[styles.stepper, quantity >= offer.available && styles.stepperDisabled]}>
          <Text style={styles.stepperText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function buildOffers(map: SeatMap | null, floorPlan: FloorPlan | null): ZoneOffer[] {
  if (!map) return [];
  const names = new Map((floorPlan?.zones ?? []).map((zone) => [zone.zoneCode, zone.name]));
  const byZone = new Map<string, ZoneOffer>();
  for (const seat of map.seats) {
    const offer = byZone.get(seat.zoneCode) ?? {
      zoneCode: seat.zoneCode,
      name: names.get(seat.zoneCode) ?? seat.sectionLabel ?? seat.ticketTypeName ?? seat.zoneCode,
      kind: 'SEATED' as const,
      priceVnd: seat.priceVnd,
      available: 0,
    };
    if (seat.status === 'AVAILABLE') offer.available += 1;
    byZone.set(seat.zoneCode, offer);
  }
  for (const zone of map.standingZones) {
    byZone.set(zone.zoneCode, {
      zoneCode: zone.zoneCode,
      name: names.get(zone.zoneCode) ?? zone.ticketTypeName ?? zone.zoneCode,
      kind: 'STANDING',
      priceVnd: zone.priceVnd,
      available: zone.available,
    });
  }
  return [...byZone.values()].sort((first, second) => second.priceVnd - first.priceVnd || first.zoneCode.localeCompare(second.zoneCode));
}

function getKey(ref: { current: KeyForSelection | null }, signature: string) {
  if (!ref.current || ref.current.signature !== signature) {
    ref.current = { signature, key: newIdempotencyKey() };
  }
  return ref.current.key;
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.code === 'UNAUTHENTICATED') {
      return 'Backend từ chối phiên đăng nhập. Issuer của token Keycloak có thể chưa khớp cấu hình backend.';
    }
    if (error.status === 403 || error.code === 'FORBIDDEN') {
      return 'Tài khoản hiện không được phép giữ chỗ cho suất diễn này.';
    }
    if (error.code === 'HOLD_LIMIT_EXCEEDED' || error.code === 'CUSTOMER_LIMIT_EXCEEDED') return 'Số vé đã chọn vượt giới hạn mua.';
    if (error.code === 'SALES_CLOSED') return 'Suất diễn chưa mở bán hoặc đã đóng bán.';
    if (error.code === 'CHECKOUT_UNAVAILABLE') {
      return 'Đã giữ được chỗ nhưng chưa mở được thanh toán. Chỗ đã được trả lại, vui lòng thử lại sau.';
    }
    if (error.code === 'HOLD_EXPIRED' || error.code === 'HOLD_NOT_FOUND') return 'Lượt giữ chỗ đã hết hiệu lực. Vui lòng bấm giữ chỗ lại.';
    if (error.code === 'ZONE_SOLD_OUT') return 'Khu vực này đã hết vé.';
    if (error.code === 'SESSION_NOT_FOUND') return 'Không tìm thấy suất diễn.';
    if (error.code === 'INVENTORY_UNAVAILABLE') return 'Hệ thống giữ chỗ đang bận. Vui lòng thử lại sau ít phút.';
    if (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT') return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';
    if (error.code === 'SEAT_UNAVAILABLE' || error.status === 409) return 'Vừa có người khác chọn chỗ này. Tình trạng chỗ đã được làm mới.';
  }
  return 'Không thể giữ chỗ lúc này. Vui lòng thử lại.';
}

function formatPrice(value: number) {
  return `${new Intl.NumberFormat('vi-VN').format(value)}đ`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111713' },
  header: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#344238' },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backGlyph: { color: '#F1F5F1', fontSize: 36, lineHeight: 40 },
  headerTitle: { maxWidth: '72%', color: '#F1F5F1', fontSize: 13, fontWeight: '700' },
  listContent: { paddingHorizontal: 16, paddingBottom: 20 },
  signInNotice: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: 13, marginTop: 14, borderRadius: 10, backgroundColor: '#1F2A22' },
  noticeText: { flex: 1, color: '#C4CEC5', fontSize: 12 },
  noticeLink: { color: '#D5FF66', fontSize: 12, fontWeight: '800' },
  intro: { marginTop: 23, marginBottom: 13 },
  eyebrow: { color: '#D5FF66', fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginBottom: 5 },
  sectionTitle: { color: '#F1F5F1', fontSize: 17, fontWeight: '800' },
  muted: { color: '#A6B1A8', fontSize: 11, lineHeight: 17, marginTop: 4 },
  mapImage: { width: '100%', height: 220, borderRadius: 13, backgroundColor: '#19221B' },
  planFrame: { padding: 9, borderRadius: 13, borderWidth: 1, borderColor: '#344238', backgroundColor: '#19221B' },
  planCaption: { color: '#A6B1A8', fontSize: 10, textAlign: 'center', marginTop: 5 },
  mapFallback: { minHeight: 104, alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 13, borderWidth: 1, borderColor: '#344238', backgroundColor: '#19221B' },
  fallbackTitle: { color: '#F1F5F1', fontSize: 13, fontWeight: '700' },
  legend: { flexDirection: 'row', gap: 14, marginTop: 12, marginBottom: 22 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { color: '#A6B1A8', fontSize: 10 },
  zoneHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 },
  zoneCard: { minHeight: 90, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 9, padding: 13, marginBottom: 9, borderRadius: 12, borderWidth: 1, borderColor: '#344238', backgroundColor: '#19221B' },
  zoneCardSelected: { borderColor: '#D5FF66' },
  zoneInfo: { flex: 1, minWidth: 0 },
  zoneName: { color: '#F1F5F1', fontSize: 13, fontWeight: '800' },
  zoneMeta: { color: '#A6B1A8', fontSize: 10, marginTop: 4 },
  zonePrice: { color: '#D5FF66', fontSize: 12, fontWeight: '800', marginTop: 7 },
  quantityControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepper: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#3B493F', backgroundColor: '#1F2A22' },
  stepperDisabled: { opacity: 0.4 },
  stepperText: { color: '#F1F5F1', fontSize: 21, lineHeight: 24 },
  quantity: { width: 19, color: '#F1F5F1', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  allowance: { color: '#A6B1A8', fontSize: 11, marginTop: 3 },
  failure: { color: '#FF8C79', fontSize: 12, lineHeight: 18, marginTop: 10 },
  terms: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 18 },
  checkbox: { width: 21, height: 21, alignItems: 'center', justifyContent: 'center', borderRadius: 5, borderWidth: 1, borderColor: '#87938A' },
  checkboxChecked: { borderColor: '#D5FF66', backgroundColor: '#D5FF66' },
  checkmark: { color: '#17210D', fontSize: 14, fontWeight: '900' },
  termsText: { flex: 1, color: '#A6B1A8', fontSize: 11, lineHeight: 17 },
  bottomBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 12, borderTopWidth: 1, borderTopColor: '#344238', backgroundColor: '#19221B' },
  total: { color: '#D5FF66', fontSize: 15, fontWeight: '900', marginTop: 3 },
  primaryButton: { minHeight: 47, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15, borderRadius: 10, backgroundColor: '#D5FF66' },
  buttonDisabled: { opacity: 0.48 },
  primaryButtonText: { color: '#17210D', fontSize: 12, fontWeight: '900' },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 13, padding: 24 },
});