import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <Text style={styles.eyebrow}>NEXATICKET</Text>
      <Text style={styles.title}>Không tìm thấy trang này</Text>
      <Link href="/" style={styles.link}>
        <Text style={styles.linkText}>Về trang khám phá</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#171211',
  },
  eyebrow: { color: '#F2B705', fontSize: 11, fontWeight: '900', letterSpacing: 1.7 },
  title: {
    color: '#F5F1EF',
    fontSize: 21,
    fontWeight: '800',
    marginTop: 10,
  },
  link: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 20,
    borderRadius: 9,
    backgroundColor: '#C02A2A',
  },
  linkText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
