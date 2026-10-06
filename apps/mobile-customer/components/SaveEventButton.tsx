import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';
import { useSavedEvents } from '@/lib/saved-events';

/**
 * Nút lưu ở góc trên bên phải ảnh sự kiện.
 *
 * Đặt BÊN TRONG thẻ bấm được: Pressable lồng nhau trong React Native chỉ kích hoạt cái trong cùng,
 * nên chạm vào nút lưu không mở trang chi tiết. Vùng chạm 40px + hitSlop cho đủ ~48px.
 */
export function SaveEventButton({ slug, title, size = 'md' }: { slug: string; title: string; size?: 'md' | 'lg' }) {
  const { isSaved, toggle } = useSavedEvents();
  const saved = isSaved(slug);
  const dimension = size === 'lg' ? 44 : 36;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: saved }}
      accessibilityLabel={saved ? `Bỏ lưu ${title}` : `Lưu ${title}`}
      hitSlop={6}
      onPress={() => toggle(slug)}
      style={({ pressed }) => [
        styles.button,
        { width: dimension, height: dimension, borderRadius: dimension / 2 },
        saved && styles.saved,
        pressed && styles.pressed,
      ]}
    >
      <SymbolView
        name={saved ? { ios: 'bookmark.fill', android: 'bookmark', web: 'bookmark' } : { ios: 'bookmark', android: 'bookmark_border', web: 'bookmark_border' }}
        tintColor={saved ? '#2A1F00' : '#FFFFFF'}
        size={size === 'lg' ? 20 : 17}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Nền tối trong mờ: nổi trên mọi ảnh poster, sáng hay tối.
  button: { position: 'absolute', top: 10, right: 10, zIndex: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(16, 12, 11, 0.62)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  // Đã lưu: vàng kim — màu nhấn của app.
  saved: { backgroundColor: '#F2B705', borderColor: '#F2B705' },
  pressed: { transform: [{ scale: 0.92 }] },
});
