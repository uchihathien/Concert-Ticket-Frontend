import {
  ApiError,
  scanTicketForOrganization,
  type CheckinResult,
  type ScanResponse,
} from '@nexaticket/ts-sdk';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { useScannerAuth } from '@/lib/auth-context';

const VERDICTS: Record<CheckinResult, { title: string; hint: string; accepted: boolean }> = {
  ACCEPTED: { title: 'MỜI VÀO', hint: 'Vé hợp lệ.', accepted: true },
  ALREADY_CHECKED_IN: { title: 'ĐÃ SOÁT RỒI', hint: 'Mã này đã được dùng để vào trước đó.', accepted: false },
  REVOKED: { title: 'VÉ ĐÃ HUỶ', hint: 'Vé bị thu hồi hoặc đã hoàn tiền.', accepted: false },
  WRONG_SESSION: { title: 'SAI SUẤT DIỄN', hint: 'Vé thuộc một suất diễn khác.', accepted: false },
  INVALID_TOKEN: { title: 'MÃ KHÔNG HỢP LỆ', hint: 'Mã sai hoặc đã hết hạn.', accepted: false },
  NOT_FOUND: { title: 'KHÔNG TÌM THẤY VÉ', hint: 'Không có vé ứng với mã này.', accepted: false },
};

export default function ScanScreen() {
  const params = useLocalSearchParams<{
    eventSessionId?: string;
    organizationId?: string;
    eventTitle?: string;
    venueName?: string;
    startsAt?: string;
  }>();
  const eventSessionId = firstParam(params.eventSessionId);
  const organizationId = firstParam(params.organizationId);
  const eventTitle = firstParam(params.eventTitle);
  const venueName = firstParam(params.venueName);
  const startsAt = firstParam(params.startsAt);
  const { signedIn } = useScannerAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [torch, setTorch] = useState(false);
  const busyRef = useRef(false);

  async function handleBarcode(data: string) {
    if (busyRef.current || result || failure || !data) return;
    if (!organizationId || !eventSessionId) {
      setFailure('Thiếu thông tin tổ chức hoặc suất diễn. Hãy chọn lại suất.');
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      const response = await scanTicketForOrganization(api, organizationId, eventSessionId, {
        qrToken: data,
        deviceId: 'mobile-scanner',
      });
      setResult(response);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setFailure('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để tiếp tục.');
      } else if (error instanceof ApiError && error.status === 403) {
        setFailure('Tài khoản chưa được cấp quyền soát vé cho tổ chức này.');
      } else {
        setFailure('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function scanNext() {
    setResult(null);
    setFailure(null);
  }

  if (!signedIn) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <Text style={styles.title}>Cần đăng nhập lại</Text>
          <Text style={styles.copy}>Phiên nhân viên không còn hoạt động.</Text>
          <ActionButton label="Về đăng nhập" onPress={() => router.replace('/')} />
        </View>
      </SafeAreaView>
    );
  }

  const verdict = result ? VERDICTS[result.result] : null;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Đổi suất diễn" onPress={() => router.replace('/')} style={styles.headerButton}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <View style={styles.sessionInfo}>
          <Text style={styles.eyebrow}>ĐANG SOÁT SUẤT</Text>
          <Text numberOfLines={1} style={styles.session}>{eventTitle || eventSessionId}</Text>
          {venueName ? (
            <Text numberOfLines={1} style={styles.sessionMeta}>
              {venueName}{startsAt ? ` · ${formatSessionDate(startsAt)}` : ''}
            </Text>
          ) : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={torch ? 'Tắt đèn pin' : 'Bật đèn pin'} onPress={() => setTorch((value) => !value)} style={styles.torchButton}>
          <Text style={styles.torchText}>{torch ? 'ĐÈN BẬT' : 'ĐÈN TẮT'}</Text>
        </Pressable>
      </View>

      <View style={styles.cameraShell}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torch}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={busy || result || failure ? undefined : ({ data }) => void handleBarcode(data)}
            onMountError={() => setFailure('Không mở được camera. Kiểm tra quyền camera trong cài đặt thiết bị.')}
          />
        ) : (
          <View style={styles.permission}>
            <Text style={styles.cameraSymbol}>▦</Text>
            <Text style={styles.permissionTitle}>Cho phép dùng camera</Text>
            <Text style={styles.permissionCopy}>Camera chỉ dùng để đọc mã QR trên vé.</Text>
            {permission?.canAskAgain === false ? (
              <Text style={styles.permissionCopy}>Hãy bật quyền camera trong phần Cài đặt của thiết bị.</Text>
            ) : (
              <ActionButton label="CẤP QUYỀN CAMERA" onPress={() => void requestPermission()} />
            )}
          </View>
        )}
        {permission?.granted && !result && !failure ? (
          <View pointerEvents="none" style={styles.reticleWrap}>
            <View style={styles.reticle} />
            <Text style={styles.cameraHint}>{busy ? 'ĐANG KIỂM TRA VÉ...' : 'ĐƯA MÃ QR VÀO KHUNG'}</Text>
          </View>
        ) : null}
      </View>

      {busy ? (
        <View style={styles.busyRow}><ActivityIndicator color="#D5FF66" /><Text style={styles.busyText}>Đang xác thực với máy chủ</Text></View>
      ) : null}

      {result && verdict ? (
        <View style={[styles.resultPanel, verdict.accepted ? styles.accepted : styles.rejected]} accessibilityRole="alert">
          <Text style={[styles.verdict, verdict.accepted ? styles.acceptedText : styles.rejectedText]}>{verdict.title}</Text>
          {result.seatLabel || result.seatCode ? (
            <Text style={styles.ticketInfo}>{result.seatLabel ?? result.seatCode}{result.ticketTypeName ? ` · ${result.ticketTypeName}` : ''}</Text>
          ) : null}
          <Text style={styles.resultHint}>{result.note ?? verdict.hint}</Text>
          <ActionButton label="QUÉT VÉ TIẾP THEO" onPress={scanNext} />
        </View>
      ) : null}

      {failure ? (
        <View style={[styles.resultPanel, styles.rejected]} accessibilityRole="alert">
          <Text style={[styles.verdict, styles.rejectedText]}>KHÔNG GỬI ĐƯỢC</Text>
          <Text style={styles.resultHint}>{failure}</Text>
          <ActionButton label="THỬ LẠI" onPress={scanNext} />
        </View>
      ) : null}

      {!result && !failure ? (
        <View style={styles.footer}>
          <Text style={styles.footerTitle}>CHỈ CHẤP NHẬN VÉ ĐÃ THANH TOÁN</Text>
          <Text style={styles.footerCopy}>Máy chủ xác thực mã và trạng thái check-in. Không quét lại cùng một vé.</Text>
        </View>
      ) : null}
      </ScrollView>
    </SafeAreaView>
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

function formatSessionDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111713' },
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 10 },
  header: { minHeight: 66, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#26312A', gap: 8 },
  headerButton: { width: 42, height: 44, alignItems: 'center', justifyContent: 'center' },
  back: { color: '#F1F5F1', fontSize: 34, lineHeight: 38 },
  sessionInfo: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#95A298', fontSize: 8, fontWeight: '900', letterSpacing: 1.4 },
  session: { color: '#EAF0EB', fontSize: 11, fontWeight: '700', marginTop: 4 },
  sessionMeta: { color: '#95A298', fontSize: 9, marginTop: 3 },
  torchButton: { minWidth: 66, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 7, borderWidth: 1, borderColor: '#3B493F', paddingHorizontal: 8 },
  torchText: { color: '#D5FF66', fontSize: 9, fontWeight: '900' },
  cameraShell: { height: 360, flexGrow: 0, marginHorizontal: 12, marginTop: 12, overflow: 'hidden', borderRadius: 12, backgroundColor: '#19221B' },
  permission: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  cameraSymbol: { color: '#D5FF66', fontSize: 40, marginBottom: 12 },
  permissionTitle: { color: '#F1F5F1', fontSize: 18, fontWeight: '800' },
  permissionCopy: { color: '#A6B1A8', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 8, marginBottom: 10 },
  reticleWrap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  reticle: { width: 236, aspectRatio: 1, borderWidth: 2, borderColor: '#D5FF66', borderRadius: 22 },
  cameraHint: { color: '#F1F5F1', fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginTop: 22, textShadowColor: '#000000', textShadowRadius: 8 },
  busyRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  busyText: { color: '#C2CCC4', fontSize: 12 },
  footer: { paddingHorizontal: 22, paddingVertical: 18 },
  footerTitle: { color: '#D5FF66', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  footerCopy: { color: '#89958C', fontSize: 10, lineHeight: 16, marginTop: 6 },
  resultPanel: { margin: 12, padding: 18, borderRadius: 10, borderWidth: 1 },
  accepted: { backgroundColor: '#1D2B1E', borderColor: '#77B44A' },
  rejected: { backgroundColor: '#2A201D', borderColor: '#B8624C' },
  verdict: { fontSize: 23, fontWeight: '900' },
  acceptedText: { color: '#D5FF66' },
  rejectedText: { color: '#FF9B84' },
  ticketInfo: { color: '#F1F5F1', fontSize: 15, fontWeight: '800', marginTop: 9 },
  resultHint: { color: '#C1CBC3', fontSize: 12, lineHeight: 18, marginTop: 7, marginBottom: 14 },
  actionButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 7, backgroundColor: '#D5FF66', paddingHorizontal: 15 },
  actionText: { color: '#17210D', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  pressed: { opacity: 0.8 },
  center: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { color: '#F1F5F1', fontSize: 24, fontWeight: '900' },
  copy: { color: '#A6B1A8', fontSize: 13, lineHeight: 20, marginVertical: 12 },
});