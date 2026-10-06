import { listPublicEvents, type PublicEventCard } from '@nexaticket/ts-sdk';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { publicApi } from '@/lib/api';
import { resolveMediaUrl } from '@/lib/media-url';
import { SaveEventButton } from '@/components/SaveEventButton';

const categories = [
  { id: 'all', label: 'Tất cả' },
  { id: 'nhac-song', label: 'Âm nhạc' },
  { id: 'san-khau', label: 'Sân khấu' },
  { id: 'the-thao', label: 'Thể thao' },
];

const palette = ['#7F2930', '#284E47', '#644421', '#384A69'];

export default function ExploreScreen() {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [reload, setReload] = useState(0);
  const requestSignature = JSON.stringify([submittedQuery, category, reload]);
  const [result, setResult] = useState<{
    signature: string;
    events: PublicEventCard[];
    error: boolean;
    errorDetail: string | null;
  } | null>(null);
  const currentResult = result?.signature === requestSignature ? result : null;
  const events = currentResult?.events ?? [];
  const loading = currentResult === null;
  const error = currentResult?.error ?? false;

  useEffect(() => {
    let active = true;

    listPublicEvents(publicApi, {
      query: submittedQuery || undefined,
      category: category === 'all' ? undefined : category,
      size: 24,
    })
      .then((page) => {
        if (active) setResult({ signature: requestSignature, events: page.items, error: false, errorDetail: null });
      })
      .catch((cause: unknown) => {
        console.warn('Mobile catalog request failed', cause);
        if (active) {
          setResult({
            signature: requestSignature,
            events: [],
            error: true,
            errorDetail: cause instanceof Error ? cause.message : String(cause),
          });
        }
      });

    return () => {
      active = false;
    };
  }, [submittedQuery, category, reload, requestSignature]);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <FlatList
        data={events}
        keyExtractor={(event) => event.slug}
        numColumns={2}
        columnWrapperStyle={styles.cardRow}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => {
              setReload((value) => value + 1);
            }}
            tintColor="#F2B705"
            colors={['#F2B705']}
          />
        }
        ListHeaderComponent={
          <>
            <View style={styles.topLine}>
              <View>
                <Text style={styles.brand}>NEXATICKET</Text>
                <Text style={styles.location}>TP. Hồ Chí Minh  {'\u2304'}</Text>
              </View>
              <View style={styles.liveMark}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>

            <Text style={styles.headline}>Tối nay, bạn{ '\n' }muốn đi đâu?</Text>
            <Text style={styles.subtitle}>Tìm khoảnh khắc đáng nhớ tiếp theo.</Text>

            <View style={styles.searchBox}>
              <SymbolView
                name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
                tintColor="#A89E99"
                size={20}
              />
              <TextInput
                accessibilityLabel="Tìm kiếm sự kiện"
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => setSubmittedQuery(query.trim())}
                placeholder="Tên sự kiện, nghệ sĩ, địa điểm"
                placeholderTextColor="#817671"
                returnKeyType="search"
                style={styles.searchInput}
              />
              {query.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Xóa nội dung tìm kiếm"
                  hitSlop={10}
                  onPress={() => {
                    setQuery('');
                    setSubmittedQuery('');
                  }}>
                  <Text style={styles.clearSearch}>×</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.categoryScroller}>
              {categories.map((item) => {
                const selected = category === item.id;
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setCategory(item.id)}
                    style={[styles.categoryChip, selected && styles.categoryChipSelected]}>
                    <Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.sectionHeading}>
              <View>
                <Text style={styles.eyebrow}>ĐƯỢC CỘNG ĐỒNG QUAN TÂM</Text>
                <Text style={styles.sectionTitle}>Sự kiện dành cho bạn</Text>
              </View>
              <Text style={styles.resultCount}>{events.length} sự kiện</Text>
            </View>

            {loading ? (
              <View style={styles.stateBox}>
                <ActivityIndicator color="#F2B705" size="large" />
                <Text style={styles.stateText}>Đang tìm sự kiện...</Text>
              </View>
            ) : error ? (
              <View style={styles.stateBox}>
                <Text style={styles.stateTitle}>Chưa kết nối được catalog</Text>
                <Text style={styles.stateText}>Kiểm tra API và địa chỉ máy chủ trong cấu hình.</Text>
                {__DEV__ && currentResult?.errorDetail ? (
                  <Text selectable style={styles.debugText}>{currentResult.errorDetail}</Text>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setReload((value) => value + 1)}
                  style={styles.retryButton}>
                  <Text style={styles.retryText}>Thử lại</Text>
                </Pressable>
              </View>
            ) : events.length === 0 ? (
              <View style={styles.stateBox}>
                <Text style={styles.stateTitle}>Chưa có sự kiện phù hợp</Text>
                <Text style={styles.stateText}>Thử từ khóa hoặc thể loại khác nhé.</Text>
              </View>
            ) : null}
          </>
        }
        renderItem={({ item, index }) => <EventCard event={item} index={index} />}
      />
    </SafeAreaView>
  );
}

function EventCard({ event, index }: { event: PublicEventCard; index: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Xem sự kiện ${event.title}`}
      onPress={() => router.push({ pathname: '/events/[slug]', params: { slug: event.slug } })}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={[styles.poster, { backgroundColor: palette[index % palette.length] }]}>
        {event.posterUrl ? (
          <Image source={{ uri: resolveMediaUrl(event.posterUrl) }} resizeMode="cover" style={styles.posterImage} />
        ) : (
          <>
            <View style={styles.posterRule} />
            <Text style={styles.posterWord}>LIVE{ '\n' }MUSIC</Text>
            <Text style={styles.posterCategory}>{event.category.replaceAll('-', ' ')}</Text>
          </>
        )}
        <View style={styles.posterBadge}>
          <Text numberOfLines={1} style={styles.posterBadgeText}>{event.category}</Text>
        </View>
        <SaveEventButton slug={event.slug} title={event.title} />
      </View>
      <Text numberOfLines={2} style={styles.eventTitle}>{event.title}</Text>
      <Text numberOfLines={1} style={styles.eventMeta}>
        {event.city ?? event.venueName ?? 'Đang cập nhật địa điểm'}
      </Text>
      <View style={styles.cardBottom}>
        <Text style={styles.eventDate}>
          {event.nextSessionAt ? formatEventDate(event.nextSessionAt) : 'Sắp công bố'}
        </Text>
        <Text style={styles.eventPrice}>
          {event.fromPriceVnd === null ? 'Đang cập nhật' : formatPrice(event.fromPriceVnd)}
        </Text>
      </View>
    </Pressable>
  );
}

function formatEventDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: 'short' }).format(new Date(value));
}

function formatPrice(value: number) {
  return `${new Intl.NumberFormat('vi-VN').format(value)}đ`;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#171211' },
  content: { paddingHorizontal: 18, paddingBottom: 24 },
  topLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  brand: { color: '#F2B705', fontSize: 12, fontWeight: '900', letterSpacing: 1.8 },
  location: { color: '#A89E99', fontSize: 12, marginTop: 5 },
  liveMark: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#362E2B', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#F4796B' },
  liveText: { color: '#F5F1EF', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  headline: { color: '#F5F1EF', fontSize: 32, lineHeight: 37, fontWeight: '800', marginTop: 28 },
  subtitle: { color: '#A89E99', fontSize: 14, marginTop: 8 },
  searchBox: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 15, marginTop: 22, borderRadius: 14, borderWidth: 1, borderColor: '#362E2B', backgroundColor: '#211B19' },
  searchInput: { flex: 1, minWidth: 0, color: '#F5F1EF', fontSize: 14, paddingVertical: 12 },
  clearSearch: { color: '#A89E99', fontSize: 23, lineHeight: 24, paddingHorizontal: 2 },
  categoryScroller: { flexDirection: 'row', gap: 8, marginTop: 17, marginBottom: 29 },
  categoryChip: { minHeight: 38, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: '#362E2B', backgroundColor: '#211B19' },
  categoryChipSelected: { borderColor: '#F2B705', backgroundColor: '#F2B705' },
  categoryText: { color: '#C9C0BB', fontSize: 12, fontWeight: '700' },
  categoryTextSelected: { color: '#2A1F00' },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 15 },
  eyebrow: { color: '#F4796B', fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  sectionTitle: { color: '#F5F1EF', fontSize: 19, fontWeight: '800', marginTop: 5 },
  resultCount: { color: '#A89E99', fontSize: 11, paddingBottom: 3 },
  cardRow: { justifyContent: 'space-between', marginBottom: 18 },
  card: { width: '48.2%', paddingBottom: 2 },
  cardPressed: { opacity: 0.76 },
  poster: { width: '100%', aspectRatio: 1.7, overflow: 'hidden', borderRadius: 13, justifyContent: 'flex-end', padding: 13 },
  posterImage: { ...StyleSheet.absoluteFill },
  posterRule: { position: 'absolute', top: 0, right: 16, width: 1, height: '58%', backgroundColor: 'rgba(255,255,255,0.45)' },
  posterWord: { color: '#FFF8EB', fontSize: 27, lineHeight: 27, fontWeight: '900', letterSpacing: 0.5 },
  posterCategory: { color: '#FFF8EB', fontSize: 9, textTransform: 'uppercase', marginTop: 7, opacity: 0.8 },
  posterBadge: { position: 'absolute', top: 9, left: 9, maxWidth: '68%', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 5, backgroundColor: 'rgba(16,13,12,0.8)' },
  posterBadgeText: { color: '#F5F1EF', fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  eventTitle: { color: '#F5F1EF', fontSize: 14, lineHeight: 19, fontWeight: '700', marginTop: 10, minHeight: 38 },
  eventMeta: { color: '#A89E99', fontSize: 11, marginTop: 4 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 4, marginTop: 9 },
  eventDate: { color: '#C9C0BB', fontSize: 10, flexShrink: 1 },
  eventPrice: { color: '#F2B705', fontSize: 10, fontWeight: '800', flexShrink: 1, textAlign: 'right' },
  stateBox: { minHeight: 150, alignItems: 'center', justifyContent: 'center', padding: 18, borderWidth: 1, borderColor: '#362E2B', borderRadius: 14, backgroundColor: '#211B19', marginBottom: 18 },
  stateTitle: { color: '#F5F1EF', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  stateText: { color: '#A89E99', fontSize: 12, textAlign: 'center', marginTop: 9, lineHeight: 18 },
  debugText: { color: '#F4796B', fontSize: 11, textAlign: 'center', marginTop: 8, lineHeight: 16 },
  retryButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 18, marginTop: 14, borderRadius: 9, backgroundColor: '#C02A2A' },
  retryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
});
