import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/** Header của các màn mở từ tab Tài khoản: nút quay lại + tiêu đề, cùng tông với app. */
export function ScreenHeader({ title }: { title: string }) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Quay lại"
        hitSlop={8}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/account'))}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} tintColor="#F5F1EF" size={20} />
      </Pressable>
      <Text numberOfLines={1} style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#2C2523' },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: '#211B19' },
  pressed: { opacity: 0.75 },
  title: { flex: 1, color: '#F5F1EF', fontSize: 18, fontWeight: '800' },
});
