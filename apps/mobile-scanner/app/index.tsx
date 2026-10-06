import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoginButton } from '@/components/LoginButton';
import { SessionPicker } from '@/components/SessionPicker';
import { useScannerAuth } from '@/lib/auth-context';

export default function HomeScreen() {
  const { ready, signedIn, signOut } = useScannerAuth();

  if (!ready) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loading}><ActivityIndicator color="#D5FF66" size="large" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.topline}>
          <Text style={styles.brand}>NEXATICKET / GATE</Text>
          <View style={styles.status}><View style={styles.statusDot} /><Text style={styles.statusText}>SOÁT VÉ</Text></View>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          <Text style={styles.kicker}>STAFF SCANNER</Text>
          <Text style={styles.title}>{signedIn ? 'Bắt đầu ca\nsoát vé.' : 'Vào cổng,\nkhông chờ đợi.'}</Text>
          <Text style={styles.subtitle}>
            {signedIn
              ? 'Đăng nhập nhân viên đã sẵn sàng. Nhập mã suất được ban tổ chức giao để mở camera.'
              : 'Đăng nhập bằng tài khoản nhân viên được cấp quyền soát vé.'}
          </Text>

          {signedIn ? (
            <View style={styles.form}>
              <SessionPicker />
              <Pressable accessibilityRole="button" onPress={() => void signOut()} style={styles.secondary}>
                <Text style={styles.secondaryText}>Đăng xuất nhân viên</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.loginBlock}>
              <LoginButton />
              <Text style={styles.helper}>Tài khoản cần được gán quyền check-in cho tổ chức.</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Text style={styles.footerLabel}>CHECK-IN PROTOCOL</Text>
          <Text style={styles.footerText}>Mỗi vé chỉ được chấp nhận một lần. Kết quả được xác thực trực tiếp với máy chủ.</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollView: { flex: 1 },
  screen: { flex: 1, backgroundColor: '#111713' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topline: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, borderBottomWidth: 1, borderBottomColor: '#26312A' },
  brand: { color: '#E6EEE8', fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#D5FF66' },
  statusText: { color: '#A8B4AA', fontSize: 9, fontWeight: '800' },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 24 },
  kicker: { color: '#D5FF66', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  title: { color: '#F1F5F1', fontSize: 38, lineHeight: 43, fontWeight: '900', marginTop: 14 },
  subtitle: { color: '#A6B1A8', fontSize: 14, lineHeight: 21, marginTop: 14, maxWidth: 380 },
  form: { marginTop: 34 },
  label: { color: '#A6B1A8', fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 9 },
  input: { minHeight: 54, borderRadius: 8, borderWidth: 1, borderColor: '#3B493F', backgroundColor: '#19221B', paddingHorizontal: 14, color: '#F1F5F1', fontSize: 13 },
  error: { color: '#FF8C79', fontSize: 12, lineHeight: 18, marginTop: 8 },
  primary: { minHeight: 56, marginTop: 14, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#D5FF66', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pressed: { opacity: 0.8 },
  primaryText: { color: '#17210D', fontSize: 12, fontWeight: '900', letterSpacing: 0.6 },
  arrow: { color: '#17210D', fontSize: 22, fontWeight: '700' },
  secondary: { minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  secondaryText: { color: '#A6B1A8', fontSize: 12, fontWeight: '700' },
  loginBlock: { marginTop: 34 },
  helper: { color: '#819087', fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 12 },
  footer: { borderTopWidth: 1, borderTopColor: '#26312A', paddingHorizontal: 22, paddingVertical: 18 },
  footerLabel: { color: '#D5FF66', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  footerText: { color: '#87938A', fontSize: 10, lineHeight: 16, marginTop: 6 },
});