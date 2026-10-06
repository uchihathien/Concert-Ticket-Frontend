import * as AuthSession from 'expo-auth-session';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { useMobileAuth } from '@/lib/auth-context';
import { discovery, exchangeMobileCode, mobileClientId, redirectUri } from '@/lib/auth-session';

export function LoginButton() {
  const { refresh } = useMobileAuth();
  const handledCode = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [request, response, promptAsync] = AuthSession.useAuthRequest({
    clientId: mobileClientId,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    scopes: ['openid', 'profile', 'email'],
    usePKCE: true,
  }, discovery);

  useEffect(() => {
    if (response?.type !== 'success' || !request?.codeVerifier) return;
    const code = response.params.code;
    if (!code || handledCode.current === code) return;
    handledCode.current = code;
    setBusy(true);
    exchangeMobileCode(code, request.codeVerifier)
      .then(async () => { await refresh(); router.replace('/'); })
      .catch((error: unknown) => Alert.alert('Đăng nhập thất bại', error instanceof Error ? error.message : 'Không thể đăng nhập.'))
      .finally(() => setBusy(false));
  }, [response, request, refresh]);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={!request || busy}
      onPress={() => { setBusy(true); void promptAsync().finally(() => setBusy(false)); }}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, (!request || busy) && styles.disabled]}
    >
      <Text style={styles.text}>{busy ? 'Đang kết nối...' : 'Đăng nhập NexaTicket'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#D5FF66', paddingHorizontal: 18 },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.55 },
  text: { color: '#17210D', fontSize: 15, fontWeight: '800' },
});