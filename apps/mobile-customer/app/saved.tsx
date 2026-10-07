import { getPublicEvent, type PublicEventDetail } from '@nexaticket/ts-sdk';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SaveEventButton } from '@/components/SaveEventButton';
import { ScreenHeader } from '@/components/ScreenHeader';
import { api } from '@/lib/api';
import { resolveMediaUrl } from '@/lib/media-url';
import { useSavedEvents } from '@/lib/saved-events';
import { formatSessionTime } from '@/lib/session-index';

type Loaded = { slug: string; event: PublicEventDetail | null };

/**
 * Sự kiện đã lưu. Máy chỉ giữ slug; chi tiết tải lại mỗi lần mở nên tên, ảnh, ngày diễn luôn mới.
 * Sự kiện đã bị gỡ (404) vẫn hiện một dòng để người dùng tự bỏ lưu — lặng lẽ biến mất thì họ tưởng
 * app làm mất dữ liệu.
 */
export default function SavedScreen() {
  const { slugs, ready, remove } = useSavedEvents();
  const [loaded, setLoaded] = useState<Record<string, PublicEventDetail | null>>({});
  // Mốc "bây giờ" lấy một lần khi mở màn — đủ để chọn suất sắp diễn tiếp theo.
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    const missing = slugs.filter((slug) => !(slug in loaded));
    if (missing.length === 0) return;
    void Promise.all(
      missing.map((slug) => getPublicEvent(api, slug).then((event) => [slug, event] as const).catch(() => [slug, null] as const)),
    ).then((entries) => {
      if (active) setLoaded((current) => ({ ...current, ...Object.fromEntries(entries) }));
    });
    return () => { active = false; };
  }, [slugs, loaded]);

  const rows: Loaded[] = slugs.map((slug) => ({ slug, event: loaded[slug] ?? null }));
  const pending = slugs.some((slug) => !(slug in loaded));

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenHeader title="Sự kiện đã lưu" />
      {!ready ? (
        <View style={styles.center}><ActivityIndicator color="#D5FF66" /></View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.slug}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            slugs.length > 0 ? (
              <Text style={styles.note}>{slugs.length} sự kiện · lưu trên thiết bị này{pending ? ' · đang tải…' : ''}</Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Chưa lưu sự kiện nào</Text>
              <Text style={styles.small}>Nhấn biểu tượng lưu ở góc trên bên phải ảnh sự kiện để thêm vào đây.</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push('/')} style={styles.cta}>
                <Text style={styles.ctaText}>Khám phá sự kiện</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) =>
            item.event ? (
              <SavedCard event={item.event} now={now} />
            ) : item.slug in loaded ? (
              <View style={styles.gone}>
                <Text style={styles.goneText}>Sự kiện không còn khả dụng</Text>
                <Pressable accessibilityRole="button" onPress={() => remove(item.slug)}>
                  <Text style={styles.goneAction}>Bỏ lưu</Text>
                </Pressable>
              </View>
            ) : (
              <View style={[styles.card, styles.skeleton]} />
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

function SavedCard({ event, now }: { event: PublicEventDetail; now: number }) {
  const next = [...event.sessions].sort((a, b) => a.startsAt.localeCompare(b.startsAt)).find((session) => Date.parse(session.startsAt) > now);
  const prices = event.sessions.flatMap((session) => session.tiers.map((tier) => tier.priceVnd));
  const from = prices.length > 0 ? Math.min(...prices) : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Xem sự kiện ${event.title}`}
      onPress={() => router.push({ pathname: '/events/[slug]', params: { slug: event.slug } })}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.thumb}>
        {event.posterUrl ? <Image source={{ uri: resolveMediaUrl(event.posterUrl) }} resizeMode="cover" style={styles.thumbImage} /> : null}
        <SaveEventButton slug={event.slug} title={event.title} />
      </View>
      <View style={styles.body}>
        <Text numberOfLines={2} style={styles.title}>{event.title}</Text>
        <Text numberOfLines={1} style={styles.small}>{next ? formatSessionTime(next.startsAt) : 'Không còn suất sắp diễn'}</Text>
        <Text numberOfLines={1} style={styles.small}>{[event.venueName, event.city].filter(Boolean).join(' · ') || 'Đang cập nhật địa điểm'}</Text>
        {from !== null ? <Text style={styles.price}>Từ {new Intl.NumberFormat('vi-VN').format(from)}đ</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111713' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  note: { color: '#A6B1A8', fontSize: 12 },
  card: { flexDirection: 'row', gap: 12, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: '#344238', backgroundColor: '#19221B' },
  cardPressed: { backgroundColor: '#1F2A22' },
  skeleton: { height: 110, opacity: 0.6 },
  thumb: { width: 120, aspectRatio: 1.1, overflow: 'hidden', borderRadius: 10, backgroundColor: '#1F2A22' },
  thumbImage: { width: '100%', height: '100%' },
  body: { flex: 1, minWidth: 0, gap: 3, justifyContent: 'center' },
  title: { color: '#F1F5F1', fontSize: 15, fontWeight: '800', marginBottom: 2 },
  small: { color: '#A6B1A8', fontSize: 12, lineHeight: 18 },
  price: { color: '#D5FF66', fontSize: 14, fontWeight: '800', marginTop: 2 },
  gone: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#3B493F' },
  goneText: { color: '#A6B1A8', fontSize: 13 },
  goneAction: { color: '#FF8C79', fontSize: 13, fontWeight: '700' },
  empty: { padding: 20, borderRadius: 14, borderWidth: 1, borderColor: '#344238', backgroundColor: '#19221B', gap: 6 },
  emptyTitle: { color: '#F1F5F1', fontSize: 15, fontWeight: '800' },
  cta: { alignSelf: 'flex-start', minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, marginTop: 8, borderRadius: 10, backgroundColor: '#D5FF66' },
  ctaText: { color: '#17210D', fontSize: 13, fontWeight: '800' },
});
