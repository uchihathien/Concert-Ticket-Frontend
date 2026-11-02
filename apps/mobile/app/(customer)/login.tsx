import { router } from 'expo-router';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoginButton } from '@/components/LoginButton';
import { brandLogo, loginTheme } from '@/constants/login-theme';

/**
 * Màn chưa đăng nhập của app khách.
 *
 * Dựng giống thẻ form trên trang Keycloak (theme `nexaticket-lime`) mà nút bên dưới sẽ mở: cùng
 * nền, logo ở đầu, tiêu đề cùng cỡ, nút chính rộng hết chiều ngang. Hai màn nối tiếp nhau trong vài
 * giây nên phải nhìn như một — người dùng không được thấy giao diện "nhảy" khi trình duyệt mở ra.
 *
 * Không có ô mật khẩu: mật khẩu chỉ nhập trên trang Keycloak (PKCE), không qua app.
 */
export default function LoginScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>‹</Text>
      </Pressable>
      <View style={styles.content}>
        <Image source={brandLogo} style={styles.logo} resizeMode="contain" accessibilityLabel="NexaTicket" />
        <View style={styles.heading}>
          <Text style={styles.title} accessibilityRole="header">
            Đăng nhập
          </Text>
          <Text style={styles.subtitle}>Giữ chỗ, thanh toán và xem vé của bạn ở một tài khoản duy nhất.</Text>
        </View>
        {Platform.OS === 'web' ? (
          <Text style={styles.notice}>Đăng nhập native khả dụng trong ứng dụng iOS và Android.</Text>
        ) : (
          <LoginButton />
        )}
        <Text style={styles.footnote}>
          Bạn sẽ nhập mật khẩu trên trang đăng nhập bảo mật của NexaTicket, rồi quay lại đúng chỗ đang xem.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: loginTheme.screen },
  back: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', marginLeft: 8, marginTop: 4 },
  backText: { color: loginTheme.text, fontSize: 38, lineHeight: 42 },
  // Cùng lề 20px với thẻ form của theme ở bề ngang điện thoại.
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 20, paddingBottom: 60, gap: 20 },
  logo: { width: loginTheme.logoWidth, height: loginTheme.logoHeight },
  heading: { gap: 8 },
  title: { color: loginTheme.text, fontSize: loginTheme.titleFont, lineHeight: 31, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: loginTheme.muted, fontSize: 15, lineHeight: 22 },
  notice: { color: loginTheme.muted, fontSize: 14, lineHeight: 20 },
  footnote: { color: loginTheme.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
