import { Pressable, StyleSheet, Text } from 'react-native';
import { useMobileAuth } from '@/lib/auth-context';

/**
 * Từ máy quét về khu ban tổ chức — chỉ hiện với tài khoản có cả hai vai (chủ tổ chức, quản lý sự
 * kiện). Chiều ngược lại là tab "Soát vé" trong app tổ chức. Nhân viên soát vé thuần không thấy nút.
 */
export function SwitchRoleButton() {
  const { roles, mode, chooseRole } = useMobileAuth();
  if (mode !== 'scanner' || !roles.includes('organizer')) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Về khu ban tổ chức"
      onPress={() => void chooseRole('organizer')}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Text style={styles.text}>Ban tổ chức</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 7, borderWidth: 1, borderColor: '#3B493F' },
  pressed: { opacity: 0.7 },
  text: { color: '#D5FF66', fontSize: 13, fontWeight: '700' },
});
