import {
  ApiError,
  endShift,
  getCheckinHistory,
  scanAtGate,
  type GateScanRequest,
  type GateScanResponse,
  type ScanDirection,
} from '@nexaticket/ts-sdk';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PromptSheet } from '@/components/PromptSheet';
import { SwitchRoleButton } from '@/components/SwitchRoleButton';
import { api } from '@/lib/api';
import { useMobileAuth } from '@/lib/auth-context';
import { TONE_COLORS, formatClock, formatSessionDate, verdictOf, vibrateFor } from '@/lib/scan-verdicts';
import { isNetworkFailure, useOnline } from '@/lib/offline/network';
import { clearOfflineData, deviceId, downloadBundle, hasBundle, pendingCount, scanOffline, syncQueue } from '@/lib/offline/store';
import { canSwitchSession, loadScannerContext, pickSession, type ScannerSession } from '@/lib/scanner-sessions';

/** Tải bù dữ liệu vé và gửi hàng đợi định kỳ khi có mạng. */
const REFRESH_MS = 45_000;

/**
 * Cùng một mã lọt vào khung hình hàng chục lần mỗi giây. Trong khoảng này mã vừa quét bị bỏ qua, để
 * khách còn đang giơ điện thoại không bị báo "đang ở trong" ngay sau khi vừa được cho vào.
 */
const REPEAT_GUARD_MS = 4000;

type Sheet = 'code' | 'override' | null;

export default function ScanScreen() {
  const params = useLocalSearchParams<{
    eventSessionId?: string;
    organizationId?: string;
    eventTitle?: string;
    venueName?: string;
    startsAt?: string;
    /** Có khi mở từ "Ca của tôi": cổng cố định theo ca, và có nút KẾT THÚC CA. */
    shiftId?: string;
    gateName?: string;
    shiftEndsAt?: string;
  }>();
  // Suất tự chọn khi màn này được mở mà không kèm suất nào (vào thẳng sau đăng nhập, app nạp lại).
  // Nhân viên đã được gán sự kiện thì không phải quay lại chọn: máy quét tự tìm suất của họ.
  const [autoSession, setAutoSession] = useState<ScannerSession | null>(null);
  const [resolving, setResolving] = useState(!firstParam(params.eventSessionId));
  const eventSessionId = firstParam(params.eventSessionId) || autoSession?.eventSessionId || '';
  const organizationId = firstParam(params.organizationId) || autoSession?.organizationId || '';
  const eventTitle = firstParam(params.eventTitle) || autoSession?.eventTitle || '';
  const venueName = firstParam(params.venueName) || autoSession?.venueName || '';
  const startsAt = firstParam(params.startsAt) || autoSession?.startsAt || '';
  const hasSessionParam = Boolean(firstParam(params.eventSessionId));
  const shiftId = firstParam(params.shiftId);
  // Cổng do CA quyết định (server cũng ghi đúng cổng của ca, bất kể máy gửi gì). Người quản lý soát
  // không theo ca thì không có cổng.
  const gate = firstParam(params.gateName);
  const [ending, setEnding] = useState(false);
  const online = useOnline();
  /** Kết quả đang hiện do MÁY quyết định (lúc mất mạng), chưa qua server. */
  const [decidedOffline, setDecidedOffline] = useState(false);
  const [pending, setPending] = useState(() => pendingCount(firstParam(params.eventSessionId)));
  const [offlineReady, setOfflineReady] = useState(() => hasBundle(firstParam(params.eventSessionId)));
  const syncing = useRef(false);
  const { signedIn, signOut } = useMobileAuth();
  const [permission, requestPermission] = useCameraPermissions();

  const [direction, setDirection] = useState<ScanDirection>('IN');
  const [result, setResult] = useState<GateScanResponse | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [torch, setTorch] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [counts, setCounts] = useState<{ inside: number; checkedIn: number } | null>(null);
  const [sessions, setSessions] = useState<ScannerSession[]>([]);
  const [switchable, setSwitchable] = useState(false);
  const [overrideOrganizations, setOverrideOrganizations] = useState<string[]>([]);
  const canOverride = overrideOrganizations.includes(organizationId);

  const busyRef = useRef(false);
  const lastScan = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  /** Lượt quét bị báo "đang ở trong" gần nhất — thứ nút "Cho vào thủ công" sẽ gửi lại kèm lý do. */
  const lastRequest = useRef<Pick<GateScanRequest, 'qrToken' | 'ticketCode'> | null>(null);

  const refreshCounts = useCallback(() => {
    if (!organizationId || !eventSessionId) return;
    getCheckinHistory(api, organizationId, eventSessionId, { size: 1 })
      .then((history) => setCounts({ inside: history.inside, checkedIn: history.checkedIn }))
      // Số đếm chỉ để tham khảo: mất mạng một nhịp không được che mất máy quét.
      .catch(() => undefined);
  }, [organizationId, eventSessionId]);

  // Máy khác ở cổng khác cũng đang quét cùng suất, nên số đếm phải tự cập nhật chứ không chỉ sau
  // lượt quét của máy này.
  useFocusEffect(
    useCallback(() => {
      refreshCounts();
      const timer = setInterval(refreshCounts, 20_000);
      return () => clearInterval(timer);
    }, [refreshCounts]),
  );

  /**
   * Gửi hàng đợi offline lên server, rồi tải bù phần vé đổi. Có xung đột thì báo ngay cho nhân viên —
   * đó là khách đã được cho vào mà server không đồng ý.
   */
  const syncNow = useCallback(async () => {
    if (!organizationId || !eventSessionId || syncing.current) return;
    syncing.current = true;
    try {
      const synced = await syncQueue(organizationId, eventSessionId);
      await downloadBundle(organizationId, eventSessionId, firstParam(params.shiftEndsAt) || null);
      setOfflineReady(true);
      if (synced && synced.conflicts > 0) {
        const lines = synced.scans
          .filter((scan) => scan.conflict)
          .slice(0, 8)
          .map((scan) => `• ${scan.ticketCode ?? '—'} ${scan.holderName ?? ''} — ${scan.result}`)
          .join('\n');
        Alert.alert(
          `${synced.conflicts} lượt xung đột`,
          `Những vé này máy đã cho vào lúc mất mạng nhưng máy chủ không đồng ý (vé đã vào ở máy khác, hoặc bị huỷ):\n\n${lines}\n\nBáo trưởng ca để kiểm tra.`,
        );
      }
      if (synced) refreshCounts();
    } catch {
      // Mất mạng giữa chừng: phần chưa gửi còn trong hàng đợi, lần sau gửi tiếp.
    } finally {
      syncing.current = false;
      setPending(pendingCount(eventSessionId));
    }
  }, [organizationId, eventSessionId, params.shiftEndsAt, refreshCounts]);

  // Có mạng (kể cả lúc vừa mở máy quét, và lúc vừa có mạng lại): gửi hàng đợi + tải bù ngay, rồi
  // định kỳ. Lần đầu cũng là lúc tải gói dữ liệu của suất về máy để soát được khi mất mạng.
  useEffect(() => {
    if (!online) return;
    const now = setTimeout(() => void syncNow(), 0);
    const timer = setInterval(() => void syncNow(), REFRESH_MS);
    return () => {
      clearTimeout(now);
      clearInterval(timer);
    };
  }, [online, syncNow]);

  useEffect(() => {
    let active = true;
    loadScannerContext()
      .then((context) => {
        if (!active) return;
        setSessions(context.sessions);
        setSwitchable(canSwitchSession(context));
        setOverrideOrganizations(context.overrideOrganizations);
        if (!hasSessionParam) setAutoSession(pickSession(context.sessions));
      })
      .catch(() => undefined)
      .finally(() => { if (active) setResolving(false); });
    return () => { active = false; };
  }, [hasSessionParam]);

  async function submit(request: Pick<GateScanRequest, 'qrToken' | 'ticketCode' | 'override' | 'reason'>) {
    if (busyRef.current) return;
    if (!organizationId || !eventSessionId) {
      setFailure('Thiếu thông tin tổ chức hoặc suất diễn. Hãy chọn lại suất.');
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setFailure(null);
    const decideHere = async () => {
      // Mất mạng: máy tự quyết định trên dữ liệu đã tải, xếp lượt quét vào hàng đợi.
      const response = await scanOffline({
        organizationId,
        sessionId: eventSessionId,
        direction,
        qrToken: request.qrToken,
        ticketCode: request.ticketCode,
        gate: gate || null,
      });
      lastRequest.current = null;
      setDecidedOffline(true);
      setResult(response);
      setPending(pendingCount(eventSessionId));
      vibrateFor(verdictOf(response).tone);
    };
    try {
      if (!online && hasBundle(eventSessionId) && !request.override) {
        await decideHere();
        return;
      }
      const response = await scanAtGate(api, organizationId, eventSessionId, {
        ...request,
        direction: request.override ? 'IN' : direction,
        deviceId: await deviceId(),
      });
      lastRequest.current = { qrToken: request.qrToken, ticketCode: request.ticketCode };
      setDecidedOffline(false);
      setResult(response);
      vibrateFor(verdictOf(response).tone);
      if (response.result === 'ACCEPTED' || response.result === 'EXITED') refreshCounts();
    } catch (error) {
      // Mạng rớt ngay giữa lượt quét (NetInfo chưa kịp báo): soát offline luôn, không bắt khách quét lại.
      if (isNetworkFailure(error) && hasBundle(eventSessionId) && !request.override) {
        try {
          await decideHere();
          return;
        } catch {
          // rơi xuống báo lỗi bên dưới
        }
      }
      setResult(null);
      vibrateFor('deny');
      if (error instanceof ApiError && error.status === 401) {
        setFailure('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để tiếp tục.');
      } else if (error instanceof ApiError && error.code === 'SHIFT_NOT_ACTIVE') {
        setFailure('Bạn không còn trong ca của suất này (chưa bắt đầu ca hoặc ca đã hết giờ). Quay lại "Ca của tôi".');
      } else if (error instanceof ApiError && error.status === 403) {
        setFailure(
          request.override
            ? 'Tài khoản không có quyền cho vào thủ công. Hãy gọi người quản lý sự kiện.'
            : 'Tài khoản chưa được cấp quyền soát vé cho tổ chức này.',
        );
      } else if (isNetworkFailure(error)) {
        setFailure('Mất mạng và máy chưa có dữ liệu vé của suất này để soát offline. Kết nối mạng một lần để tải.');
      } else {
        setFailure('Không kết nối được máy chủ. Kiểm tra mạng rồi quét lại.');
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function handleBarcode(data: string) {
    if (!data || busyRef.current || sheet) return;
    const now = Date.now();
    if (data === lastScan.current.code && now - lastScan.current.at < REPEAT_GUARD_MS) return;
    lastScan.current = { code: data, at: now };
    void submit({ qrToken: data });
  }

  function changeDirection(next: ScanDirection) {
    setDirection(next);
    // Đổi chế độ là bắt đầu một lượt khác: mã vừa quét Vào phải quét Ra được ngay.
    lastScan.current = { code: '', at: 0 };
    setResult(null);
    setFailure(null);
  }

  function confirmSignOut() {
    const waiting = pendingCount();
    if (waiting === 0) {
      clearOfflineData();
      void signOut();
      return;
    }
    Alert.alert(
      'Còn lượt quét chưa đồng bộ',
      `Máy còn ${waiting} lượt quét offline chưa gửi lên. Đăng xuất bây giờ sẽ MẤT các lượt này. Hãy chờ có mạng để đồng bộ trước.`,
      [
        { text: 'Ở lại', style: 'cancel' },
        { text: 'Vẫn đăng xuất', style: 'destructive', onPress: () => { clearOfflineData(); void signOut(); } },
      ],
    );
  }

  function confirmEndShift() {
    const waiting = pendingCount(eventSessionId);
    if (waiting > 0 && !online) {
      Alert.alert(
        'Chưa kết thúc ca được',
        `Còn ${waiting} lượt quét offline chưa đồng bộ, và máy đang mất mạng. Hãy chờ có mạng để gửi lên rồi kết thúc ca — tổng kết ca phải gồm cả các lượt này.`,
      );
      return;
    }
    Alert.alert(
      'Kết thúc ca?',
      waiting > 0
        ? `Máy sẽ gửi ${waiting} lượt quét offline lên trước, rồi đóng máy quét và hiện tổng kết để bàn giao.`
        : 'Máy quét đóng lại và bạn nhận tổng kết để bàn giao.',
      [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Kết thúc ca', style: 'destructive', onPress: () => void finishShift() },
    ]);
  }

  async function finishShift() {
    if (!shiftId || !organizationId) return;
    setEnding(true);
    try {
      // Gửi nốt hàng đợi để tổng kết ca tính cả lượt offline.
      await syncQueue(organizationId, eventSessionId);
      const handover = await endShift(api, organizationId, shiftId);
      router.replace({
        pathname: '/scanner/handover',
        params: {
          eventTitle,
          gateName: handover.gateName,
          startedAt: handover.startedAt,
          endedAt: handover.endedAt,
          entries: String(handover.tally.entries),
          exits: String(handover.tally.exits),
          rejected: String(handover.tally.rejected),
          overrides: String(handover.tally.overrides),
          offline: String(handover.tally.offline),
          lookups: String(handover.tally.lookups),
          pending: String(pendingCount(eventSessionId)),
        },
      });
    } catch (error) {
      setFailure(error instanceof ApiError && error.detail ? error.detail : 'Chưa kết thúc được ca. Kiểm tra mạng rồi thử lại.');
    } finally {
      setEnding(false);
    }
  }

  if (!signedIn) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <Text style={styles.title}>Cần đăng nhập lại</Text>
          <Text style={styles.copy}>Phiên nhân viên không còn hoạt động.</Text>
          <ActionButton label="Về đăng nhập" onPress={() => router.replace('/scanner')} />
        </View>
      </SafeAreaView>
    );
  }

  if (resolving) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}><ActivityIndicator color="#D5FF66" size="large" /></View>
      </SafeAreaView>
    );
  }

  if (!eventSessionId || !organizationId) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <Text style={styles.title}>Chưa có suất để soát</Text>
          <Text style={styles.copy}>
            Tài khoản chưa được gán sự kiện nào còn suất diễn, hoặc chưa tải được danh sách suất. Hãy nhờ ban tổ chức
            gán sự kiện ở mục Nhân sự soát vé rồi thử lại.
          </Text>
          <ActionButton label="THỬ LẠI" onPress={() => router.replace('/scanner')} />
        </View>
      </SafeAreaView>
    );
  }

  const verdict = result ? verdictOf(result) : null;
  const tone = verdict ? TONE_COLORS[verdict.tone] : null;
  const otherSession =
    result?.result === 'WRONG_SESSION' && result.ticketSessionId
      ? sessions.find((session) => session.eventSessionId === result.ticketSessionId)
      : undefined;
  const scanning = permission?.granted && !sheet;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.sessionInfo}>
            <Text style={styles.eyebrow}>ĐANG SOÁT SUẤT</Text>
            <Text numberOfLines={1} style={styles.session}>{eventTitle || eventSessionId}</Text>
            <Text numberOfLines={1} style={styles.sessionMeta}>
              {[startsAt ? formatSessionDate(startsAt) : '', venueName].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <View style={styles.headerActions}>
            {shiftId ? (
              <Pressable
                accessibilityRole="button"
                disabled={ending}
                onPress={confirmEndShift}
                style={({ pressed }) => [styles.endShift, pressed && styles.pressed, ending && styles.disabledButton]}>
                <Text style={styles.endShiftText}>{ending ? 'ĐANG KẾT THÚC...' : 'KẾT THÚC CA'}</Text>
              </Pressable>
            ) : switchable ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.replace({ pathname: '/scanner', params: { pick: '1' } })}
                style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
                <Text style={styles.headerButtonText}>ĐỔI SUẤT</Text>
              </Pressable>
            ) : null}
            <SwitchRoleButton />
            {/* Nhân viên được gán sự kiện vào thẳng màn này, nên đây là nơi duy nhất họ đăng xuất được. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đăng xuất nhân viên"
              onPress={confirmSignOut}
              style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}>
              <Text style={styles.signOutText}>Đăng xuất</Text>
            </Pressable>
          </View>
        </View>

        {!online ? (
          <View accessibilityRole="alert" style={styles.offlineBanner}>
            <Text style={styles.offlineText}>
              ĐANG SOÁT OFFLINE · {pending} lượt chờ đồng bộ
            </Text>
            {!offlineReady ? (
              <Text style={styles.offlineHint}>Máy chưa có dữ liệu vé của suất này — chưa soát offline được.</Text>
            ) : null}
          </View>
        ) : pending > 0 ? (
          <View style={styles.syncBanner}>
            <Text style={styles.syncText}>Đang đồng bộ {pending} lượt quét offline…</Text>
          </View>
        ) : null}

        <View style={styles.counts}>
          <Count label="ĐANG Ở TRONG" value={counts?.inside} />
          <Count label="ĐÃ CHECK-IN" value={counts?.checkedIn} />
          <View style={styles.count}>
            <Text style={styles.countLabel}>CỔNG</Text>
            <Text numberOfLines={1} style={styles.gateValue}>{gate || '—'}</Text>
          </View>
        </View>

        <View accessibilityRole="tablist" style={styles.modes}>
          <ModeButton active={direction === 'IN'} label="VÀO" tone="enter" onPress={() => changeDirection('IN')} />
          <ModeButton active={direction === 'OUT'} label="RA" tone="exit" onPress={() => changeDirection('OUT')} />
        </View>

        <View style={[styles.cameraShell, { borderColor: TONE_COLORS[direction === 'IN' ? 'enter' : 'exit'].border }]}>
          {permission?.granted ? (
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={torch}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={scanning ? ({ data }) => handleBarcode(data) : undefined}
              onMountError={() => setFailure('Không mở được camera. Kiểm tra quyền camera trong cài đặt thiết bị.')}
            />
          ) : (
            <View style={styles.permission}>
              <Text style={styles.permissionTitle}>Cho phép dùng camera</Text>
              <Text style={styles.permissionCopy}>Camera chỉ dùng để đọc mã QR trên vé.</Text>
              {permission?.canAskAgain === false ? (
                <Text style={styles.permissionCopy}>Hãy bật quyền camera trong phần Cài đặt của thiết bị.</Text>
              ) : (
                <ActionButton label="CẤP QUYỀN CAMERA" onPress={() => void requestPermission()} />
              )}
            </View>
          )}
          {permission?.granted ? (
            <View pointerEvents="none" style={styles.reticleWrap}>
              <View style={[styles.reticle, { borderColor: TONE_COLORS[direction === 'IN' ? 'enter' : 'exit'].text }]} />
              <Text style={styles.cameraHint}>
                {busy ? 'ĐANG KIỂM TRA VÉ...' : direction === 'IN' ? 'QUÉT VÉ VÀO' : 'QUÉT VÉ RA'}
              </Text>
            </View>
          ) : null}
          {busy ? <ActivityIndicator color="#D5FF66" style={styles.spinner} /> : null}
        </View>

        <View style={styles.tools}>
          <ToolButton label={torch ? 'ĐÈN BẬT' : 'ĐÈN TẮT'} onPress={() => setTorch((value) => !value)} />
          <ToolButton label="NHẬP MÃ VÉ" onPress={() => setSheet('code')} />
          <ToolButton
            label="TÌM KHÁCH"
            onPress={() =>
              router.push({
                pathname: '/scanner/lookup',
                params: { eventSessionId, organizationId, eventTitle, gateName: gate },
              })
            }
          />
          <ToolButton
            label="LỊCH SỬ"
            onPress={() =>
              router.push({ pathname: '/scanner/history', params: { eventSessionId, organizationId, eventTitle } })
            }
          />
        </View>

        {result && verdict && tone ? (
          <View accessibilityRole="alert" style={[styles.resultPanel, { backgroundColor: tone.background, borderColor: tone.border }]}>
            <View style={styles.verdictRow}>
              <Text style={[styles.verdict, { color: tone.text }]}>{verdict.title}</Text>
              {decidedOffline ? <Text style={styles.offlineTag}>offline</Text> : null}
            </View>
            {result.holderName ? <Text style={styles.holder}>{result.holderName}</Text> : null}
            {result.ticketTypeName || result.seatLabel || result.seatCode ? (
              <Text style={styles.ticketInfo}>
                {[result.ticketTypeName, seatText(result), result.ticketCode ? `Mã ${result.ticketCode}` : '']
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            ) : null}
            <Text style={styles.resultHint}>{detailOf(result, verdict.hint, otherSession)}</Text>
            {result.result === 'ALREADY_CHECKED_IN' && canOverride && !decidedOffline && online ? (
              <Pressable accessibilityRole="button" onPress={() => setSheet('override')} style={({ pressed }) => [styles.override, pressed && styles.pressed]}>
                <Text style={styles.overrideText}>CHO VÀO THỦ CÔNG</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {failure ? (
          <View accessibilityRole="alert" style={[styles.resultPanel, { backgroundColor: TONE_COLORS.deny.background, borderColor: TONE_COLORS.deny.border }]}>
            <Text style={[styles.verdict, { color: TONE_COLORS.deny.text }]}>KHÔNG GỬI ĐƯỢC</Text>
            <Text style={styles.resultHint}>{failure}</Text>
          </View>
        ) : null}

        {!result && !failure ? (
          <View style={styles.footer}>
            <Text style={styles.footerCopy}>
              Máy quét liên tục: đưa vé tiếp theo vào khung, không cần bấm gì. Kết quả do máy chủ quyết định; khi mất mạng máy tự kiểm vé đã tải và gửi lên sau.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <PromptSheet
        visible={sheet === 'code'}
        title="Nhập mã vé"
        description="Dùng khi mã QR hỏng. Gõ ít nhất 8 ký tự mã in trên vé của khách."
        placeholder="VD: 550E8400"
        confirmLabel={direction === 'IN' ? 'Soát vé VÀO' : 'Soát vé RA'}
        autoCapitalize="characters"
        maxLength={36}
        required
        onClose={() => setSheet(null)}
        onSubmit={(code) => { setSheet(null); void submit({ ticketCode: code }); }}
      />
      <PromptSheet
        visible={sheet === 'override'}
        title="Cho vào thủ công"
        description="Vé đang được ghi nhận là ở trong. Ghi rõ lý do — lần cho vào này được lưu kèm tên bạn."
        placeholder="VD: Khách ra ngoài, quên quét Ra"
        confirmLabel="Cho vào"
        maxLength={300}
        required
        onClose={() => setSheet(null)}
        onSubmit={(reason) => {
          setSheet(null);
          if (lastRequest.current) void submit({ ...lastRequest.current, override: true, reason });
        }}
      />
    </SafeAreaView>
  );
}

/** Dòng giải thích dưới kết quả: thứ nhân viên đọc cho khách. */
function detailOf(result: GateScanResponse, fallback: string, otherSession: ScannerSession | undefined): string {
  if (result.result === 'ALREADY_CHECKED_IN' && result.lastEntryAt) {
    const where = result.lastEntryGate ? `, ${result.lastEntryGate}` : '';
    return `Đã vào lúc ${formatClock(result.lastEntryAt)}${where}. Có thể mã QR đang bị dùng chung.`;
  }
  if (result.result === 'WRONG_SESSION' && otherSession) {
    return `Vé thuộc suất ${formatSessionDate(otherSession.startsAt)} · ${otherSession.eventTitle}.`;
  }
  if (result.result === 'ACCEPTED' && result.entryCount <= 1) {
    return result.note ?? fallback;
  }
  // Vào lại: câu của app ("lần vào thứ n") rõ hơn ghi chú của máy chủ.
  return result.result === 'ACCEPTED' ? fallback : result.note ?? fallback;
}

function seatText(result: GateScanResponse): string {
  const seat = result.seatLabel ?? result.seatCode;
  if (!seat) return result.zoneCode ? `Khu ${result.zoneCode}` : '';
  return result.zoneCode && !seat.includes(result.zoneCode) ? `Khu ${result.zoneCode} · ${seat}` : seat;
}

function Count({ label, value }: { label: string; value: number | undefined }) {
  return (
    <View style={styles.count}>
      <Text style={styles.countLabel}>{label}</Text>
      <Text style={styles.countValue}>{value ?? '–'}</Text>
    </View>
  );
}

function ModeButton({ active, label, tone, onPress }: { active: boolean; label: string; tone: 'enter' | 'exit'; onPress: () => void }) {
  const colors = TONE_COLORS[tone];
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.mode,
        active && { backgroundColor: colors.background, borderColor: colors.border },
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.modeText, active && { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function ToolButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.tool, pressed && styles.pressed]}>
      <Text style={styles.toolText}>{label}</Text>
    </Pressable>
  );
}

function ActionButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111713' },
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 14 },
  header: { minHeight: 66, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#26312A', gap: 10 },
  sessionInfo: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#95A298', fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  session: { color: '#F1F5F1', fontSize: 15, fontWeight: '800', marginTop: 3 },
  sessionMeta: { color: '#95A298', fontSize: 11, marginTop: 2 },
  headerButton: { minHeight: 38, justifyContent: 'center', borderRadius: 7, borderWidth: 1, borderColor: '#3B493F', paddingHorizontal: 10 },
  headerButtonText: { color: '#D5FF66', fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  signOut: { minHeight: 38, justifyContent: 'center', borderRadius: 7, borderWidth: 1, borderColor: '#3B493F', paddingHorizontal: 10 },
  signOutText: { color: '#A6B1A8', fontSize: 12, fontWeight: '700' },
  endShift: { minHeight: 38, justifyContent: 'center', borderRadius: 7, borderWidth: 1, borderColor: '#FF9B84', paddingHorizontal: 10 },
  endShiftText: { color: '#FF9B84', fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  disabledButton: { opacity: 0.55 },
  offlineBanner: { marginHorizontal: 12, marginTop: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 9, backgroundColor: '#FFC773' },
  offlineText: { color: '#2C2416', fontSize: 12, fontWeight: '900', letterSpacing: 0.6 },
  offlineHint: { color: '#2C2416', fontSize: 11, marginTop: 3 },
  syncBanner: { marginHorizontal: 12, marginTop: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9, borderWidth: 1, borderColor: '#D9902F' },
  syncText: { color: '#FFC773', fontSize: 11, fontWeight: '800' },
  verdictRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  offlineTag: { color: '#2C2416', backgroundColor: '#FFC773', fontSize: 10, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  counts: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 10 },
  count: { flex: 1, minHeight: 56, justifyContent: 'center', borderRadius: 9, backgroundColor: '#19221B', paddingHorizontal: 10 },
  countLabel: { color: '#95A298', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  countValue: { color: '#F1F5F1', fontSize: 20, fontWeight: '900', marginTop: 2 },
  gateValue: { color: '#F1F5F1', fontSize: 13, fontWeight: '800', marginTop: 6 },
  modes: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 10 },
  mode: { flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 9, borderWidth: 2, borderColor: '#2C372F', backgroundColor: '#161D18' },
  modeText: { color: '#7F8C83', fontSize: 16, fontWeight: '900', letterSpacing: 1.5 },
  cameraShell: { height: 300, marginHorizontal: 12, marginTop: 10, overflow: 'hidden', borderRadius: 12, borderWidth: 2, backgroundColor: '#19221B' },
  permission: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  permissionTitle: { color: '#F1F5F1', fontSize: 18, fontWeight: '800' },
  permissionCopy: { color: '#A6B1A8', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 8, marginBottom: 10 },
  reticleWrap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  reticle: { width: 200, aspectRatio: 1, borderWidth: 2, borderRadius: 20 },
  cameraHint: { color: '#F1F5F1', fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginTop: 14, textShadowColor: '#000000', textShadowRadius: 8 },
  spinner: { position: 'absolute', top: 12, right: 12 },
  tools: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 10 },
  tool: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#3B493F' },
  toolText: { color: '#D5FF66', fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  resultPanel: { margin: 12, marginBottom: 0, padding: 16, borderRadius: 10, borderWidth: 2 },
  verdict: { fontSize: 24, fontWeight: '900' },
  holder: { color: '#F1F5F1', fontSize: 17, fontWeight: '800', marginTop: 8 },
  ticketInfo: { color: '#DCE4DD', fontSize: 13, fontWeight: '700', marginTop: 4 },
  resultHint: { color: '#C1CBC3', fontSize: 13, lineHeight: 19, marginTop: 8 },
  override: { minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 14, borderRadius: 8, borderWidth: 1, borderColor: '#FF9B84' },
  overrideText: { color: '#FF9B84', fontSize: 12, fontWeight: '900', letterSpacing: 0.6 },
  footer: { paddingHorizontal: 22, paddingVertical: 16 },
  footerCopy: { color: '#89958C', fontSize: 11, lineHeight: 17 },
  actionButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 7, backgroundColor: '#D5FF66', paddingHorizontal: 15 },
  actionText: { color: '#17210D', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  pressed: { opacity: 0.8 },
  center: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { color: '#F1F5F1', fontSize: 24, fontWeight: '900' },
  copy: { color: '#A6B1A8', fontSize: 13, lineHeight: 20, marginVertical: 12 },
});
