import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Màn hình thay cho "Unmatched Route" mặc định của Expo Router.
 *
 * Màn hình mặc định là công cụ gỡ lỗi: nó in đường dẫn không khớp và một đống chữ tiếng Anh về router.
 * Hữu ích lúc phát triển, nhưng trong bản cài trên điện thoại thì nó là ngõ cụt — không có nút nào đưa
 * người dùng về chỗ dùng được, và với người đang xem demo thì trông như app hỏng.
 *
 * Một deep link sai, một thông báo đẩy trỏ vào đường dẫn đã bỏ, hay một lần đổi tên route mà quên chỗ
 * nào đó đều dẫn tới đây. Có một lối ra thì hỏng một đường dẫn chỉ còn là phiền, không phải bế tắc.
 */
export default function NotFoundScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ title: 'Không tìm thấy' }} />
      <View style={styles.body}>
        <Text style={styles.title}>Không mở được trang này</Text>
        <Text style={styles.detail}>
          Đường dẫn vừa mở không còn tồn tại trong ứng dụng. Quay về trang chính để tiếp tục quét vé.
        </Text>
        <Link href="/" replace style={styles.action}>
          Về trang chính
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111713' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 28 },
  title: { color: '#F4F8F2', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  detail: { color: '#A8B5A2', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  action: {
    marginTop: 8,
    minHeight: 54,
    lineHeight: 54,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#D5FF66',
    color: '#17210D',
    fontSize: 14,
    fontWeight: '800',
    overflow: 'hidden',
  },
});
