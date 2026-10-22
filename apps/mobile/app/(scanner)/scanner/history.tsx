import { getCheckinHistory, type CheckinHistory, type CheckinHistoryRow } from '@nexaticket/ts-sdk';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { TONE_COLORS, formatClock, resultLabel, toneOf } from '@/lib/scan-verdicts';

const METHOD_LABEL: Record<CheckinHistoryRow['method'], string> = {
  QR: '',
  CODE: 'Gõ mã',
  OVERRIDE: 'Thủ công',
  LOOKUP: 'Tra cứu',
};

export default function HistoryScreen() {
  const params = useLocalSearchParams<{ eventSessionId?: string; organizationId?: string; eventTitle?: string }>();
  const eventSessionId = firstParam(params.eventSessionId);
  const organizationId = firstParam(params.organizationId);
  const eventTitle = firstParam(params.eventTitle);

  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<CheckinHistory | null>(null);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [loadedKey, setLoadedKey] = useState('');
  const requestKey = `${query}:${reload}`;
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    if (!organizationId || !eventSessionId) return;
    let active = true;
    // Chờ người gõ dừng tay: mỗi phím một lời gọi thì kết quả cũ về sau sẽ đè kết quả mới.
    const timer = setTimeout(() => {
      getCheckinHistory(api, organizationId, eventSessionId, { query, size: 100 })
        .then((value) => { if (active) { setHistory(value); setError(false); } })
        .catch(() => { if (active) setError(true); })
        .finally(() => { if (active) setLoadedKey(requestKey); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [organizationId, eventSessionId, query, reload, requestKey]);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Quay lại máy quét" onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>LỊCH SỬ QUÉT</Text>
          <Text numberOfLines={1} style={styles.title}>{eventTitle || 'Suất đang soát'}</Text>
        </View>
        {history ? (
          <Text style={styles.summary}>{history.inside} trong · {history.checkedIn} đã vào</Text>
        ) : null}
      </View>

      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        onChangeText={setQuery}
        placeholder="Tìm theo tên khách hoặc mã vé"
        placeholderTextColor="#6F7C73"
        returnKeyType="search"
        style={styles.search}
        value={query}
      />

      <FlatList
        data={history?.rows ?? []}
        keyExtractor={(row) => row.id}
        keyboardShouldPersistTaps="handled"
        onRefresh={() => setReload((value) => value + 1)}
        refreshing={loading && history !== null}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <Row row={item} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            {loading ? (
              <ActivityIndicator color="#D5FF66" />
            ) : (
              <Text style={styles.emptyText}>
                {error
                  ? 'Không tải được lịch sử. Kéo xuống để thử lại.'
                  : query.trim()
                    ? 'Không có lượt quét nào khớp.'
                    : 'Chưa có lượt quét nào ở suất này.'}
              </Text>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}

function Row({ row }: { row: CheckinHistoryRow }) {
  const tone = TONE_COLORS[toneOf(row.result)];
  const seat = row.seatLabel ?? row.seatCode;
  const meta = [row.ticketTypeName, seat, row.gate, METHOD_LABEL[row.method]].filter(Boolean).join(' · ');
  return (
    <View style={[styles.row, { borderLeftColor: tone.border }]}>
      <View style={styles.rowTop}>
        <Text style={styles.time}>{formatClock(row.scannedAt)}</Text>
        <Text style={[styles.direction, row.direction === 'OUT' && styles.directionOut]}>
          {row.direction === 'OUT' ? 'RA' : 'VÀO'}
        </Text>
        <Text numberOfLines={1} style={[styles.result, { color: tone.text }]}>{resultLabel(row.result)}</Text>
      </View>
      <Text numberOfLines={1} style={styles.holder}>
        {row.holderName ?? 'Không xác định được vé'}{row.ticketCode ? ` · ${row.ticketCode}` : ''}
      </Text>
      {meta ? <Text numberOfLines={1} style={styles.meta}>{meta}</Text> : null}
      {row.note ? <Text style={styles.note}>{row.note}</Text> : null}
    </View>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111713' },
  header: { minHeight: 62, flexDirection: 'row', alignItems: 'center', paddingRight: 14, borderBottomWidth: 1, borderBottomColor: '#26312A', gap: 4 },
  back: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#F1F5F1', fontSize: 34, lineHeight: 38 },
  headerText: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#95A298', fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: '#F1F5F1', fontSize: 15, fontWeight: '800', marginTop: 3 },
  summary: { color: '#D5FF66', fontSize: 11, fontWeight: '800' },
  search: { minHeight: 46, margin: 12, marginBottom: 4, borderRadius: 8, borderWidth: 1, borderColor: '#3B493F', backgroundColor: '#19221B', color: '#F1F5F1', fontSize: 14, paddingHorizontal: 12 },
  list: { flexGrow: 1, padding: 12, gap: 8 },
  row: { borderRadius: 9, borderLeftWidth: 4, backgroundColor: '#19221B', paddingHorizontal: 12, paddingVertical: 10 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  time: { color: '#F1F5F1', fontSize: 13, fontWeight: '800' },
  direction: { overflow: 'hidden', borderRadius: 4, backgroundColor: '#26331F', color: '#D5FF66', fontSize: 9, fontWeight: '900', letterSpacing: 0.8, paddingHorizontal: 6, paddingVertical: 2 },
  directionOut: { backgroundColor: '#1B2B40', color: '#8CC2FF' },
  result: { flex: 1, textAlign: 'right', fontSize: 11, fontWeight: '900', letterSpacing: 0.4 },
  holder: { color: '#F1F5F1', fontSize: 14, fontWeight: '700', marginTop: 6 },
  meta: { color: '#A6B1A8', fontSize: 12, marginTop: 2 },
  note: { color: '#C1CBC3', fontSize: 12, lineHeight: 17, marginTop: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyText: { color: '#A6B1A8', fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
