import { getStaffAccountStatus } from '@nexaticket/ts-sdk';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoginButton } from '@/components/LoginButton';
import { publicApi } from '@/lib/api';
import { useMobileAuth } from '@/lib/auth-context';
import { StaffLoginError, signInWithStaffPin } from '@/lib/auth-session';
import { parseStaffLoginLink } from '@/lib/staff-login-link';

/**
 * Đăng nhập của bản NexaTicket Staff.
 *
 * Ba lối vào, xếp theo mức thường dùng ở cổng:
 *
 * 1. Quét mã QR trên phiếu nhân viên — nhanh nhất, không gõ gì.
 * 2. Gõ tên đăng nhập + PIN in trên phiếu — khi camera hỏng hoặc phiếu bị nhoè.
 * 3. "Đăng nhập ban tổ chức" — tài khoản email, qua trình duyệt (PKCE). Dòng chữ nhỏ cuối màn: đây
 *    không phải lối của nhân viên thời vụ, và nút lớn sẽ làm họ bấm nhầm.
 *
 * Mở bằng deep link `nexaticket-staff://login?u=…&p=…` cũng tự đăng nhập (xem `+native-intent`).
 */
export default function StaffLoginScreen() {
  const { refresh } = useMobileAuth();
  const params = useLocalSearchParams<{ u?: string; p?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const handledLink = useRef<string | null>(null);

  const signIn = useCallback(
    async (name: string, code: string) => {
      if (busyRef.current) return;
      if (!name.trim() || !/^\d{6}$/.test(code)) {
        setError('Nhập tên đăng nhập và mã PIN 6 số in trên phiếu.');
        return;
      }
      busyRef.current = true;
      setBusy(true);
      setError(null);
      try {
        await signInWithStaffPin(name, code);
        // Root layout tự chuyển sang khu ban tổ chức / máy quét khi vai đã rõ.
        await refresh();
      } catch (cause) {
        setError(await messageFor(cause, name));
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [refresh],
  );

  // Deep link mang sẵn tên đăng nhập + PIN: đăng nhập ngay, một lần cho mỗi đường dẫn.
  const linkUser = first(params.u);
  const linkPin = first(params.p);
  useEffect(() => {
    if (!linkUser || !linkPin) return;
    const key = `${linkUser}:${linkPin}`;
    if (handledLink.current === key) return;
    handledLink.current = key;
    void signIn(linkUser, linkPin);
  }, [linkUser, linkPin, signIn]);

  function handleScan(data: string) {
    if (busyRef.current) return;
    const link = parseStaffLoginLink(data);
    if (!link) {
      setError('Đây không phải mã QR đăng nhập nhân viên. Hãy quét mã trên phiếu do ban tổ chức phát.');
      return;
    }
    setScanning(false);
    setUsername(link.username);
    void signIn(link.username, link.pin);
  }

  if (scanning) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.cameraHeader}>
          <Text style={styles.brand}>NEXATICKET STAFF</Text>
          <Pressable accessibilityRole="button" onPress={() => setScanning(false)} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
            <Text style={styles.closeText}>Đóng</Text>
          </Pressable>
        </View>
        <View style={styles.cameraShell}>
          {permission?.granted ? (
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => handleScan(data)}
            />
          ) : (
            <View style={styles.permission}>
              <Text style={styles.permissionTitle}>Cho phép dùng camera</Text>
              <Text style={styles.copy}>Camera chỉ dùng để đọc mã QR trên phiếu nhân viên.</Text>
              {permission?.canAskAgain === false ? (
                <Text style={styles.copy}>Hãy bật quyền camera trong phần Cài đặt của thiết bị.</Text>
              ) : (
                <Primary label="CẤP QUYỀN CAMERA" onPress={() => void requestPermission()} />
              )}
            </View>
          )}
          {permission?.granted ? (
            <View pointerEvents="none" style={styles.reticleWrap}>
              <View style={styles.reticle} />
              <Text style={styles.cameraHint}>ĐƯA MÃ QR TRÊN PHIẾU VÀO KHUNG</Text>
            </View>
          ) : null}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.brand}>NEXATICKET STAFF</Text>
          <Text style={styles.title}>Đăng nhập{'\n'}nhân viên</Text>
          <Text style={styles.copy}>Dùng phiếu nhân viên do ban tổ chức phát.</Text>

          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => {
              setError(null);
              setScanning(true);
            }}
            style={({ pressed }) => [styles.scanButton, pressed && styles.pressed, busy && styles.disabled]}>
            <Text style={styles.scanText}>QUÉT MÃ QR NHÂN VIÊN</Text>
            <Text style={styles.scanArrow}>›</Text>
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>hoặc nhập tay</Text>
            <View style={styles.divider} />
          </View>

          <Text style={styles.label}>TÊN ĐĂNG NHẬP</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="VD: nexa-nv01"
            placeholderTextColor="#6F7B72"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          <Text style={[styles.label, styles.labelGap]}>MÃ PIN</Text>
          <TextInput
            value={pin}
            onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6 số"
            placeholderTextColor="#6F7B72"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            style={[styles.input, styles.pinInput]}
            onSubmitEditing={() => void signIn(username, pin)}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void signIn(username, pin)}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed, busy && styles.disabled]}>
            {busy ? <ActivityIndicator color="#17210D" /> : <Text style={styles.primaryText}>ĐĂNG NHẬP</Text>}
          </Pressable>

          <View style={styles.organizer}>
            <LoginButton variant="link" label="Đăng nhập ban tổ chức ›" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Câu nói cho nhân viên — mỗi trường hợp một việc cần làm tiếp. */
async function messageFor(cause: unknown, username: string): Promise<string> {
  const reason = cause instanceof StaffLoginError ? cause.reason : 'unknown';
  switch (reason) {
    case 'credentials':
      return 'Sai tên đăng nhập hoặc mã PIN. Kiểm tra lại phiếu nhân viên.';
    case 'throttled':
      return 'Nhập sai quá nhiều lần nên tài khoản tạm bị chặn. Đợi vài phút rồi thử lại.';
    case 'network':
      return 'Không kết nối được máy chủ. Kiểm tra Wi-Fi / 4G rồi thử lại.';
    case 'disabled': {
      // Keycloak nói cùng một câu cho "bị khoá" và "hết hạn"; hỏi identity xem là trường hợp nào.
      const status = await getStaffAccountStatus(publicApi, username).catch(() => 'UNKNOWN' as const);
      if (status === 'EXPIRED') {
        return 'Tài khoản đã hết hạn (suất diễn được giao đã kết thúc). Gọi ban tổ chức để được gia hạn.';
      }
      return 'Tài khoản đã bị ban tổ chức khoá. Liên hệ trưởng ca hoặc ban tổ chức.';
    }
    default:
      return 'Chưa đăng nhập được. Thử lại sau ít phút.';
  }
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function Primary({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: '#111713' },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 28 },
  brand: { color: '#D5FF66', fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  title: { color: '#F1F5F1', fontSize: 36, lineHeight: 41, fontWeight: '900', marginTop: 14 },
  copy: { color: '#A6B1A8', fontSize: 14, lineHeight: 21, marginTop: 10 },
  scanButton: { minHeight: 64, marginTop: 28, paddingHorizontal: 18, borderRadius: 10, backgroundColor: '#D5FF66', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scanText: { color: '#17210D', fontSize: 15, fontWeight: '900', letterSpacing: 0.8 },
  scanArrow: { color: '#17210D', fontSize: 26, fontWeight: '700' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 24 },
  divider: { flex: 1, height: 1, backgroundColor: '#2C372F' },
  dividerText: { color: '#819087', fontSize: 12, fontWeight: '700' },
  label: { color: '#A6B1A8', fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 8 },
  labelGap: { marginTop: 14 },
  input: { minHeight: 52, borderRadius: 8, borderWidth: 1, borderColor: '#3B493F', backgroundColor: '#19221B', paddingHorizontal: 14, color: '#F1F5F1', fontSize: 16 },
  pinInput: { letterSpacing: 6, fontSize: 20 },
  error: { color: '#FF8C79', fontSize: 13, lineHeight: 19, marginTop: 14, paddingHorizontal: 2 },
  primary: { minHeight: 54, marginTop: 18, borderRadius: 8, backgroundColor: '#D5FF66', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryText: { color: '#17210D', fontSize: 13, fontWeight: '900', letterSpacing: 0.8 },
  organizer: { marginTop: 18, alignItems: 'center' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.55 },
  cameraHeader: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#26312A' },
  close: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 7, borderWidth: 1, borderColor: '#3B493F' },
  closeText: { color: '#A6B1A8', fontSize: 13, fontWeight: '700' },
  cameraShell: { flex: 1, margin: 14, overflow: 'hidden', borderRadius: 14, borderWidth: 2, borderColor: '#77B44A', backgroundColor: '#19221B' },
  permission: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  permissionTitle: { color: '#F1F5F1', fontSize: 18, fontWeight: '800' },
  reticleWrap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  reticle: { width: 230, aspectRatio: 1, borderWidth: 2, borderRadius: 20, borderColor: '#D5FF66' },
  cameraHint: { color: '#F1F5F1', fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginTop: 14, textShadowColor: '#000000', textShadowRadius: 8 },
});
