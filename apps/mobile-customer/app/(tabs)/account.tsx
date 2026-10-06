import { SymbolView } from 'expo-symbols';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMobileAuth } from '@/lib/auth-context';

export default function AccountScreen() {
  const { ready, signedIn, signOut } = useMobileAuth();

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>NEXATICKET / CÁ NHÂN</Text>
        <Text style={styles.title}>Tài khoản</Text>
        <View style={styles.accountPanel}>
          <View style={styles.avatar}>
            <SymbolView name={{ ios: 'person.fill', android: 'person', web: 'person' }} tintColor="#F2B705" size={28} />
          </View>
          <Text style={styles.panelTitle}>{signedIn ? 'Bạn đã đăng nhập' : 'Chào bạn đến với NexaTicket'}</Text>
          <Text style={styles.body}>{signedIn ? 'Phiên đăng nhập của bạn đã sẵn sàng.' : 'Đăng nhập để quản lý vé, đơn hàng và nhận gợi ý sự kiện phù hợp.'}</Text>
          {!signedIn ? (
            <Link href="/login" asChild>
              <Pressable accessibilityRole="button" style={styles.loginButton}>
                <Text style={styles.loginText}>{ready ? 'Đăng nhập' : 'Đang kiểm tra phiên...'}</Text>
              </Pressable>
            </Link>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => void signOut()} style={styles.loginButton}>
              <Text style={styles.loginText}>Đăng xuất</Text>
            </Pressable>
          )}
          <View style={styles.divider} />
          <Text style={styles.rowText}>Đơn hàng của tôi</Text>
          <Text style={styles.rowText}>Sự kiện đã lưu</Text>
          <Text style={styles.rowText}>Trợ giúp & hỗ trợ</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#171211' },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 30 },
  eyebrow: { color: '#F4796B', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: '#F5F1EF', fontSize: 28, fontWeight: '800', marginTop: 8 },
  accountPanel: { borderRadius: 14, borderWidth: 1, borderColor: '#362E2B', backgroundColor: '#211B19', padding: 20, marginTop: 26 },
  avatar: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#2A2321', marginBottom: 15 },
  panelTitle: { color: '#F5F1EF', fontSize: 17, fontWeight: '800' },
  body: { color: '#A89E99', fontSize: 13, lineHeight: 20, marginTop: 7 },
  loginButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginTop: 16, borderRadius: 9, backgroundColor: '#C02A2A' },
  loginText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  divider: { height: 1, backgroundColor: '#362E2B', marginVertical: 16 },
  rowText: { color: '#C9C0BB', fontSize: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#362E2B' },
});