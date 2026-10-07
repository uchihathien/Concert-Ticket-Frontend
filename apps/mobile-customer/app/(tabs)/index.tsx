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
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { publicApi } from '@/lib/api';
import { resolveMediaUrl } from '@/lib/media-url';
import { SaveEventButton } from '@/components/SaveEventButton';
import { ALL_CITIES, CityPickerSheet } from '@/components/CityPickerSheet';
import { FeaturedBanner } from '@/components/FeaturedBanner';

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
  const [city, setCity] = useState(ALL_CITIES);
  const [cityOpen, setCityOpen] = useState(false);
  // Danh sách thành phố backend gửi kèm mỗi trang kết quả (EventPage.cities) — giữ lại bản đầy đủ
  // nhất để bảng chọn không co lại khi đang lọc theo một thành phố.
  const [cities, setCities] = useState<string[]>([]);
  const [featured, setFeatured] = useState<PublicEventCard[]>([]);
  const [reload, setReload] = useState(0);
  const { width } = useWindowDimensions();
  const requestSignature = JSON.stringify([submittedQuery, category, city, reload]);
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
      city: city === ALL_CITIES ? undefined : city,
      size: 24,
    })
      .then((page) => {
        if (!active) return;
        setResult({ signature: requestSignature, events: page.items, error: false, errorDetail: null });
        if (page.cities.length > 0) setCities((current) => (page.cities.length >= current.length ? page.cities : current));
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
  }, [submittedQuery, category, city, reload, requestSignature]);

  // Banner: sự kiện có ảnh, không phụ thuộc bộ lọc — banner là "nổi bật toàn trang", như hero web.
  useEffect(() => {
    let active = true;
    listPublicEvents(publicApi, { size: 12 })
      .then((page) => {
        if (!active) return;
        setFeatured(page.items.filter((event) => event.posterUrl).slice(0, 5));
        if (page.cities.length > 0) setCities((current) => (page.cities.length >= current.length ? page.cities : current));
      })
      .catch(() => {
        if (active) setFeatured([]);
      });
    return () => { active = false; };
  }, [reload]);

  const cityLabel = city === ALL_CITIES ? 'Toàn quốc' : city;

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
            tintColor="#D5FF66"
            colors={['#D5FF66']}
          />
        }
        ListHeaderComponent={
          <>
            <View style={styles.topLine}>
              <View>
                <Text style={styles.brand}>NEXATICKET</Text>
                {/* Trước đây là chữ tĩnh "TP. Hồ Chí Minh ⌄" không bấm được — giờ lọc thật, như ô thành phố trên web. */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Chọn thành phố, đang chọn ${cityLabel}`}
                  hitSlop={8}
                  onPress={() => setCityOpen(true)}
                  style={({ pressed }) => [styles.locationButton, pressed && styles.locationPressed]}
                >
                  <SymbolView name={{ ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' }} tintColor="#D5FF66" size={14} />
                  <Text style={styles.location}>{cityLabel}</Text>
                  <SymbolView name={{ ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }} tintColor="#A6B1A8" size={12} />
                </Pressable>
              </View>
              <View style={styles.liveMark}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>

            <FeaturedBanner events={featured} width={width - 36} />

            <View style={styles.searchBox}>
              <SymbolView
                name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
                tintColor="#A6B1A8"
                size={20}
              />
              <TextInput
                accessibilityLabel="Tìm kiếm sự kiện"
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => setSubmittedQuery(query.trim())}
                placeholder="Tên sự kiện, nghệ sĩ, địa điểm"
                placeholderTextColor="#87938A"
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
                <Text style={styles.sectionTitle}>{city === ALL_CITIES ? 'Sự kiện dành cho bạn' : `Sự kiện tại ${city}`}</Text>
              </View>
              <Text style={styles.resultCount}>{events.length} sự kiện</Text>
            </View>

            {loading ? (
              <View style={styles.stateBox}>
                <ActivityIndicator color="#D5FF66" size="large" />
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
      <CityPickerSheet
        visible={cityOpen}
        cities={cities}
        value={city}
        onSelect={setCity}
        onClose={() => setCityOpen(false)}
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
  safeArea: { flex: 1, backgroundColor: '#111713' },
  content: { paddingHorizontal: 18, paddingBottom: 24 },
  topLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  brand: { color: '#D5FF66', fontSize: 12, fontWeight: '900', letterSpacing: 1.8 },
  locationButton: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', minHeight: 32, paddingHorizontal: 10, marginTop: 6, borderRadius: 999, borderWidth: 1, borderColor: '#344238', backgroundColor: '#19221B' },
  locationPressed: { borderColor: '#D5FF66' },
  location: { color: '#F1F5F1', fontSize: 13, fontWeight: '700' },
  liveMark: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#344238', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D5FF66' },
  liveText: { color: '#F1F5F1', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  searchBox: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 15, marginTop: 22, borderRadius: 14, borderWidth: 1, borderColor: '#344238', backgroundColor: '#19221B' },
  searchInput: { flex: 1, minWidth: 0, color: '#F1F5F1', fontSize: 14, paddingVertical: 12 },
  clearSearch: { color: '#A6B1A8', fontSize: 23, lineHeight: 24, paddingHorizontal: 2 },
  categoryScroller: { flexDirection: 'row', gap: 8, marginTop: 17, marginBottom: 29 },
  categoryChip: { minHeight: 38, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: '#344238', backgroundColor: '#19221B' },
  categoryChipSelected: { borderColor: '#D5FF66', backgroundColor: '#D5FF66' },
  categoryText: { color: '#C4CEC5', fontSize: 12, fontWeight: '700' },
  categoryTextSelected: { color: '#17210D' },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 15 },
  eyebrow: { color: '#D5FF66', fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  sectionTitle: { color: '#F1F5F1', fontSize: 19, fontWeight: '800', marginTop: 5 },
  resultCount: { color: '#A6B1A8', fontSize: 11, paddingBottom: 3 },
  cardRow: { justifyContent: 'space-between', marginBottom: 18 },
  card: { width: '48.2%', paddingBottom: 2 },
  cardPressed: { opacity: 0.76 },
  poster: { width: '100%', aspectRatio: 1.7, overflow: 'hidden', borderRadius: 13, justifyContent: 'flex-end', padding: 13 },
  posterImage: { ...StyleSheet.absoluteFill },
  posterRule: { position: 'absolute', top: 0, right: 16, width: 1, height: '58%', backgroundColor: 'rgba(255,255,255,0.45)' },
  posterWord: { color: '#FFF8EB', fontSize: 27, lineHeight: 27, fontWeight: '900', letterSpacing: 0.5 },
  posterCategory: { color: '#FFF8EB', fontSize: 9, textTransform: 'uppercase', marginTop: 7, opacity: 0.8 },
  posterBadge: { position: 'absolute', top: 9, left: 9, maxWidth: '68%', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 5, backgroundColor: 'rgba(13,18,15,0.8)' },
  posterBadgeText: { color: '#F1F5F1', fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  eventTitle: { color: '#F1F5F1', fontSize: 14, lineHeight: 19, fontWeight: '700', marginTop: 10, minHeight: 38 },
  eventMeta: { color: '#A6B1A8', fontSize: 11, marginTop: 4 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 4, marginTop: 9 },
  eventDate: { color: '#C4CEC5', fontSize: 10, flexShrink: 1 },
  eventPrice: { color: '#D5FF66', fontSize: 10, fontWeight: '800', flexShrink: 1, textAlign: 'right' },
  stateBox: { minHeight: 150, alignItems: 'center', justifyContent: 'center', padding: 18, borderWidth: 1, borderColor: '#344238', borderRadius: 14, backgroundColor: '#19221B', marginBottom: 18 },
  stateTitle: { color: '#F1F5F1', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  stateText: { color: '#A6B1A8', fontSize: 12, textAlign: 'center', marginTop: 9, lineHeight: 18 },
  debugText: { color: '#D5FF66', fontSize: 11, textAlign: 'center', marginTop: 8, lineHeight: 16 },
  retryButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 18, marginTop: 14, borderRadius: 9, backgroundColor: '#D5FF66' },
  retryText: { color: '#17210D', fontSize: 12, fontWeight: '800' },
});
