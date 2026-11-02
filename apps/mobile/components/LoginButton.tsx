import * as AuthSession from 'expo-auth-session';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { loginTheme } from '@/constants/login-theme';
import { useMobileAuth } from '@/lib/auth-context';
import { discovery, exchangeMobileCode, mobileClientId, redirectUri } from '@/lib/auth-session';

/** `link`: dòng chữ nhỏ thay vì nút lớn — dùng ở màn đăng nhập nhân viên cho tài khoản email. */
export function LoginButton({ variant = 'button', label }: { variant?: 'button' | 'link'; label?: string } = {}) {
  const { refresh } = useMobileAuth();
  const handledCode = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: mobileClientId,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      scopes: ['openid', 'profile', 'email'],
      usePKCE: true,
      // Bắt Keycloak luôn hỏi tài khoản: phiên SSO còn sống (của app khác hoặc tài khoản vừa thoát)
      // không được tự đăng nhập vào app này.
      prompt: AuthSession.Prompt.Login,
      // Trang đăng nhập Keycloak luôn hiện tiếng Việt, kể cả khi điện thoại để tiếng Anh.
      extraParams: { ui_locales: 'vi' },
    },
    discovery,
  );

  useEffect(() => {
    if (response?.type !== 'success' || !request?.codeVerifier) return;
    const code = response.params.code;
    if (!code || handledCode.current === code) return;
    handledCode.current = code;
    setBusy(true);
    exchangeMobileCode(code, request.codeVerifier)
      .then(async () => {
        // Khách mua vé quay lại đúng màn đang xem. Các vai khác không cần điều hướng ở đây: root
        // layout đóng nhóm (customer) và tự chuyển sang nhóm màn hình của vai đó.
        if ((await refresh()) === 'customer') router.back();
      })
      .catch((error: unknown) => {
        const detail = error instanceof Error ? error.message : 'Không thể hoàn tất xác thực với Keycloak.';
        Alert.alert('Đăng nhập chưa thành công', detail);
      })
      .finally(() => setBusy(false));
  }, [response, request, refresh]);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={!request || busy}
      onPress={() => {
        setBusy(true);
        void promptAsync({ preferEphemeralSession: true }).finally(() => setBusy(false));
      }}
      style={({ pressed }) => [
        variant === 'link' ? styles.link : styles.button,
        pressed && styles.pressed,
        (!request || busy) && styles.disabled,
      ]}>
      <Text style={variant === 'link' ? styles.linkText : styles.text}>
        {busy ? 'Đang mở trang đăng nhập…' : label ?? 'Đăng nhập'}
      </Text>
    </Pressable>
  );
}

// Cùng kích thước và chữ với nút "Đăng nhập" trên trang Keycloak (theme nexaticket-lime).
const styles = StyleSheet.create({
  button: {
    minHeight: loginTheme.buttonHeight,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: loginTheme.radius,
    backgroundColor: loginTheme.primary,
    paddingHorizontal: 24,
  },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.55 },
  text: { color: loginTheme.primaryInk, fontSize: loginTheme.buttonFont, fontWeight: '600' },
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  linkText: { color: loginTheme.primary, fontSize: 14, fontWeight: '600' },
});