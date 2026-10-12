import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';
import { MobileAuthProvider, useMobileAuth } from '@/lib/auth-context';

export default function RootLayout() {
  return (
    <MobileAuthProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </MobileAuthProvider>
  );
}

/**
 * Mỗi vai một nhóm route, và chỉ nhóm của vai đang mở là tồn tại với router: nhóm khác không điều
 * hướng tới được, kể cả bằng deep link. Khách chưa đăng nhập ở nhóm (customer).
 */
function RootNavigator() {
  const { ready, mode, refresh, signOut } = useMobileAuth();

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#D5FF66" size="large" />
      </View>
    );
  }

  if (mode === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.brand}>NEXATICKET</Text>
        <Text style={styles.title}>Chưa xác định được quyền</Text>
        <Text style={styles.copy}>Không hỏi được quyền của tài khoản từ máy chủ. Kiểm tra kết nối rồi thử lại.</Text>
        <Pressable accessibilityRole="button" onPress={() => void refresh()} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
          <Text style={styles.primaryText}>Thử lại</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => void signOut()} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
          <Text style={styles.secondaryText}>Đăng xuất</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#111713' } }}>
      <Stack.Protected guard={mode === 'customer'}>
        <Stack.Screen name="(customer)" />
      </Stack.Protected>
      <Stack.Protected guard={mode === 'organizer'}>
        <Stack.Screen name="(organizer)" />
      </Stack.Protected>
      <Stack.Protected guard={mode === 'platform'}>
        <Stack.Screen name="(platform)" />
      </Stack.Protected>
      <Stack.Protected guard={mode === 'scanner'}>
        <Stack.Screen name="(scanner)" />
      </Stack.Protected>
      <Stack.Protected guard={mode === 'choose'}>
        <Stack.Screen name="choose-role" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111713', paddingHorizontal: 26 },
  brand: { color: '#D5FF66', fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  title: { color: '#F1F5F1', fontSize: 24, fontWeight: '800', marginTop: 14, textAlign: 'center' },
  copy: { color: '#A6B1A8', fontSize: 14, lineHeight: 21, marginTop: 10, marginBottom: 24, textAlign: 'center' },
  primary: { minHeight: 50, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#D5FF66' },
  primaryText: { color: '#17210D', fontSize: 14, fontWeight: '800' },
  secondary: { minHeight: 46, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', marginTop: 10, borderRadius: 10, borderWidth: 1, borderColor: '#3B493F' },
  secondaryText: { color: '#FF8C79', fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.8 },
});
