import { Pressable, StyleSheet, Text } from 'react-native';
import { useMobileAuth } from '@/lib/auth-context';

/** Chỉ hiện với tài khoản có hơn một vai; bấm thì quay về màn chọn vai. */
export function SwitchRoleButton() {
  const { roles, switchRole } = useMobileAuth();
  if (roles.length < 2) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Đổi vai trò"
      onPress={() => void switchRole()}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Text style={styles.text}>Đổi vai</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 7, borderWidth: 1, borderColor: '#3B493F' },
  pressed: { opacity: 0.7 },
  text: { color: '#D5FF66', fontSize: 13, fontWeight: '700' },
});
