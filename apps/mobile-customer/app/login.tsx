import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoginButton } from '@/components/LoginButton';

export default function LoginScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>‹</Text>
      </Pressable>
      <View style={styles.content}>
        <Text style={styles.brand}>NEXATICKET</Text>
        <Text style={styles.title}>Chào mừng{ '\n' }bạn trở lại.</Text>
        <Text style={styles.subtitle}>Đăng nhập để tiếp tục với vé và sự kiện của bạn.</Text>
        {Platform.OS === 'web' ? (
          <Text style={styles.notice}>Đăng nhập native khả dụng trong ứng dụng iOS và Android.</Text>
        ) : (
          <LoginButton />
        )}
        <Text style={styles.footnote}>Xác thực an toàn qua NexaTicket Identity.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#171211' },
  back: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', marginLeft: 8, marginTop: 4 },
  backText: { color: '#F5F1EF', fontSize: 38, lineHeight: 42 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 26, paddingBottom: 60 },
  brand: { color: '#F2B705', fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  title: { color: '#F5F1EF', fontSize: 34, lineHeight: 40, fontWeight: '800', marginTop: 16 },
  subtitle: { color: '#A89E99', fontSize: 14, lineHeight: 21, marginTop: 12, marginBottom: 28 },
  notice: { color: '#C9C0BB', fontSize: 13, lineHeight: 20 },
  footnote: { color: '#817671', fontSize: 11, textAlign: 'center', marginTop: 18 },
});