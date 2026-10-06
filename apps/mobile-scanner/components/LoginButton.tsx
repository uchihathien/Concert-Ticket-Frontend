import * as AuthSession from 'expo-auth-session';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { useScannerAuth } from '@/lib/auth-context';
import { discovery, exchangeScannerCode, redirectUri, scannerClientId } from '@/lib/auth-session';

export function LoginButton() {
  const { refresh } = useScannerAuth();
  const handledCode = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: scannerClientId,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      scopes: ['openid', 'profile', 'email'],
      usePKCE: true,
    },
    discovery,
  );

  useEffect(() => {
    if (response?.type !== 'success' || !request?.codeVerifier) return;
    const code = response.params.code;
    if (!code || handledCode.current === code) return;
    handledCode.current = code;
    setBusy(true);
    exchangeScannerCode(code, request.codeVerifier)
      .then(async () => {
        await refresh();
        router.replace('/');
      })
      .catch((error: unknown) => {
        const detail = error instanceof Error ? error.message : 'Không thể đăng nhập qua Keycloak.';
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
        void promptAsync().finally(() => setBusy(false));
      }}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, (!request || busy) && styles.disabled]}
    >
      <Text style={styles.buttonText}>{busy ? 'Đang kết nối...' : 'Đăng nhập bằng NexaTicket'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#D5FF66', paddingHorizontal: 18 },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.58 },
  buttonText: { color: '#17210D', fontSize: 14, fontWeight: '800' },
});