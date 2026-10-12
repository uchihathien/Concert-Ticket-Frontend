import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMobileAuth } from '@/lib/auth-context';
import { ROLE_LABEL } from '@/lib/roles';

export default function ChooseRoleScreen() {
  const { roles, chooseRole, signOut } = useMobileAuth();

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>NEXATICKET</Text>
        <Text style={styles.title}>Chọn vai trò</Text>
        <Text style={styles.subtitle}>Tài khoản này có nhiều vai. Bạn có thể đổi vai bất cứ lúc nào.</Text>
        {roles.map((role) => (
          <Pressable
            key={role}
            accessibilityRole="button"
            onPress={() => void chooseRole(role)}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
            <Text style={styles.cardTitle}>{ROLE_LABEL[role].title}</Text>
            <Text style={styles.cardDetail}>{ROLE_LABEL[role].detail}</Text>
          </Pressable>
        ))}
        <Pressable accessibilityRole="button" onPress={() => void signOut()} style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}>
          <Text style={styles.signOutText}>Đăng xuất</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111713' },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 26, paddingVertical: 32 },
  brand: { color: '#D5FF66', fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  title: { color: '#F1F5F1', fontSize: 34, lineHeight: 40, fontWeight: '800', marginTop: 16 },
  subtitle: { color: '#A6B1A8', fontSize: 14, lineHeight: 21, marginTop: 12, marginBottom: 24 },
  card: { borderRadius: 10, borderWidth: 1, borderColor: '#344238', backgroundColor: '#19221B', padding: 16, marginBottom: 12 },
  cardTitle: { color: '#F1F5F1', fontSize: 16, fontWeight: '800' },
  cardDetail: { color: '#A6B1A8', fontSize: 13, lineHeight: 19, marginTop: 4 },
  signOut: { minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 12, borderRadius: 10, borderWidth: 1, borderColor: '#3B493F' },
  signOutText: { color: '#FF8C79', fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.8 },
});
