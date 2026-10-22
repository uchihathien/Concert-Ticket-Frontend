import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatClock } from '@/lib/scan-verdicts';

/**
 * Tổng kết bàn giao cuối ca — đọc to cho trưởng ca hoặc chụp màn hình gửi nhóm.
 *
 * Số liệu do server tính từ nhật ký quét của chính nhân viên trong khoảng bắt đầu → kết thúc ca,
 * kể cả lượt quét offline đã đồng bộ.
 */
export default function HandoverScreen() {
  const params = useLocalSearchParams<Record<string, string>>();
  const number = (key: string) => Number(first(params[key]) || 0);
  const pending = number('pending');

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>NEXATICKET STAFF</Text>
        <Text style={styles.title}>Bàn giao ca</Text>
        <Text style={styles.meta}>
          {first(params.eventTitle) || 'Sự kiện'} · {first(params.gateName) || 'Cổng'}
        </Text>
        <Text style={styles.meta}>
          {formatClock(first(params.startedAt))} – {formatClock(first(params.endedAt))}
        </Text>

        <View style={styles.grid}>
          <Tile label="LƯỢT VÀO" value={number('entries')} tone="#D5FF66" />
          <Tile label="LƯỢT RA" value={number('exits')} tone="#8CC2FF" />
          <Tile label="BỊ TỪ CHỐI" value={number('rejected')} tone="#FF9B84" />
          <Tile label="CHO VÀO THỦ CÔNG" value={number('overrides')} tone="#FFC773" />
          <Tile label="TRA CỨU CHO VÀO" value={number('lookups')} tone="#F1F5F1" />
          <Tile label="QUÉT OFFLINE" value={number('offline')} tone="#F1F5F1" />
        </View>

        {pending > 0 ? (
          <Text style={styles.warning}>
            Còn {pending} lượt quét offline CHƯA đồng bộ, chưa nằm trong số trên. Mở lại app khi có mạng để gửi lên.
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/scanner')}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
          <Text style={styles.primaryText}>VỀ CA CỦA TÔI</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Tile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={[styles.tileValue, { color: tone }]}>{value}</Text>
    </View>
  );
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111713' },
  content: { padding: 22, gap: 8 },
  brand: { color: '#D5FF66', fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  title: { color: '#F1F5F1', fontSize: 34, fontWeight: '900', marginTop: 10 },
  meta: { color: '#A6B1A8', fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 },
  tile: { width: '47%', minHeight: 86, justifyContent: 'center', padding: 14, borderRadius: 10, backgroundColor: '#19221B', borderWidth: 1, borderColor: '#344238' },
  tileLabel: { color: '#95A298', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  tileValue: { fontSize: 30, fontWeight: '900', marginTop: 4 },
  warning: { color: '#FFC773', fontSize: 13, lineHeight: 19, marginTop: 14 },
  primary: { minHeight: 54, marginTop: 22, borderRadius: 8, backgroundColor: '#D5FF66', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#17210D', fontSize: 13, fontWeight: '900', letterSpacing: 0.8 },
  pressed: { opacity: 0.8 },
});
