import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoginButton } from '@/components/LoginButton';
import { brandLogo, loginTheme } from '@/constants/login-theme';

/**
 * Đăng nhập của bản NexaTicket Staff.
 *
 * Nhân viên đăng nhập bằng CHÍNH tài khoản NexaTicket họ đã tự đăng ký (email, hoặc Google) — cùng
 * luồng trình duyệt + PKCE với app khách. Ban tổ chức không tạo tài khoản hộ nữa: họ thêm tài khoản
 * này vào tổ chức với vai Staff ở mục Thành viên, rồi gán sự kiện gần ngày diễn.
 *
 * Tên đăng nhập + PIN và mã QR trên phiếu nhân viên đã bỏ. Tài khoản nhân viên tạo theo cách cũ (đã
 * kích hoạt bằng thư mời) vẫn đăng nhập ở đây như mọi tài khoản khác.
 *
 * Giao diện theo cùng bộ màu với trang Keycloak `nexaticket-lime` (constants/login-theme.ts) mà nút
 * bên dưới mở ra, để không thấy giao diện "nhảy".
 */
export default function StaffLoginScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.brandRow}>
          <Image source={brandLogo} style={styles.logo} resizeMode="contain" accessibilityLabel="NexaTicket" />
          <Text style={styles.brandTag}>Staff</Text>
        </View>
        <View style={styles.heading}>
          <Text style={styles.title} accessibilityRole="header">
            Đăng nhập nhân viên
          </Text>
          <Text style={styles.copy}>
            Dùng chính tài khoản NexaTicket bạn đã đăng ký. Sau khi ban tổ chức thêm bạn với vai Staff và gán
            sự kiện, các sự kiện đó sẽ hiện ở đây.
          </Text>
        </View>
        {Platform.OS === 'web' ? (
          <Text style={styles.copy}>Đăng nhập native khả dụng trong ứng dụng iOS và Android.</Text>
        ) : (
          <LoginButton />
        )}
        <Text style={styles.footnote}>
          Chưa có tài khoản? Đăng ký NexaTicket như khách bình thường, rồi gửi email hoặc số điện thoại cho ban
          tổ chức.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: loginTheme.screen },
  // Cùng lề 20px với thẻ form của theme ở bề ngang điện thoại.
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 20, paddingBottom: 40, gap: 20 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: loginTheme.logoWidth, height: loginTheme.logoHeight },
  brandTag: { color: loginTheme.primary, fontSize: 14, fontWeight: '800' },
  heading: { gap: 8 },
  title: { color: loginTheme.text, fontSize: loginTheme.titleFont, lineHeight: 31, fontWeight: '800', letterSpacing: -0.5 },
  copy: { color: loginTheme.muted, fontSize: 15, lineHeight: 22 },
  footnote: { color: loginTheme.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
