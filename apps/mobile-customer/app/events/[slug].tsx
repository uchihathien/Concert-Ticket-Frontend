import { getPublicEvent, type PublicEventDetail } from '@nexaticket/ts-sdk';
import { SymbolView } from 'expo-symbols';
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { publicApi } from '@/lib/api';
import { useMobileAuth } from '@/lib/auth-context';
import { resolveMediaUrl } from '@/lib/media-url';

export default function EventDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { signedIn } = useMobileAuth();
  const [event, setEvent] = useState<PublicEventDetail | null>(null);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    getPublicEvent(publicApi, slug)
      .then((detail) => {
        if (active) setEvent(detail);
      })
      .catch(() => {
        if (active) setError(true);
      });

    return () => {
      active = false;
    };
  }, [slug]);

  if (error) {
    return (
      <SafeAreaView style={styles.screen}>
        <Header />
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>Không tải được sự kiện</Text>
          <Text style={styles.muted}>Sự kiện có thể đã kết thúc hoặc máy chủ đang bận.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={styles.screen}>
        <Header />
        <View style={styles.centerState}>
          <ActivityIndicator color="#F2B705" size="large" />
          <Text style={styles.muted}>Đang tải thông tin sự kiện...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentSession = event.sessions.find((session) => session.id === selectedSession);
  const fromPrice = currentSession?.tiers.length
    ? Math.min(...currentSession.tiers.map((tier) => tier.priceVnd))
    : null;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Header />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {event.posterUrl ? (
            <Image source={{ uri: resolveMediaUrl(event.posterUrl) }} resizeMode="cover" style={styles.heroImage} />
          ) : (
            <View style={styles.heroFallback}>
              <Text style={styles.heroKicker}>{event.category.replaceAll('-', ' ')}</Text>
              <Text numberOfLines={3} style={styles.heroFallbackTitle}>{event.title}</Text>
            </View>
          )}
        </View>

        <Text style={styles.category}>{event.category.replaceAll('-', ' ').toUpperCase()}</Text>
        <Text style={styles.title}>{event.title}</Text>
        <View style={styles.infoRow}>
          <SymbolView name={{ ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' }} tintColor="#F4796B" size={17} />
          <Text style={styles.infoText}>{[event.venueName, event.city].filter(Boolean).join(' · ') || 'Địa điểm sẽ được cập nhật'}</Text>
        </View>

        {event.summary ? <Text style={styles.summary}>{event.summary}</Text> : null}

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Chọn suất diễn</Text>
          <Text style={styles.muted}>{event.sessions.length} suất</Text>
        </View>

        {event.sessions.length === 0 ? (
          <View style={styles.emptySession}>
            <Text style={styles.muted}>Chưa có suất diễn được mở bán.</Text>
          </View>
        ) : (
          event.sessions.map((session) => {
            const selected = selectedSession === session.id;
            const start = new Date(session.startsAt);
            const sessionPrice = session.tiers.length
              ? Math.min(...session.tiers.map((tier) => tier.priceVnd))
              : null;
            return (
              <Pressable
                key={session.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setSelectedSession(session.id)}
                style={[styles.session, selected && styles.sessionSelected]}>
                <View style={styles.sessionDate}>
                  <Text style={styles.sessionDay}>{new Intl.DateTimeFormat('vi-VN', { day: '2-digit' }).format(start)}</Text>
                  <Text style={styles.sessionMonth}>{new Intl.DateTimeFormat('vi-VN', { month: 'short' }).format(start)}</Text>
                </View>
                <View style={styles.sessionInfo}>
                  <Text style={styles.sessionTime}>{new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(start)}</Text>
                  <Text style={styles.muted}>{event.venueName ?? event.city ?? 'Địa điểm sẽ cập nhật'}</Text>
                </View>
                <Text style={styles.price}>{sessionPrice === null ? '—' : formatPrice(sessionPrice)}</Text>
              </Pressable>
            );
          })
        )}

        {event.description ? (
          <>
            <Text style={styles.sectionTitle}>Về sự kiện</Text>
            <Text style={styles.description}>{event.description}</Text>
          </>
        ) : null}
      </ScrollView>
      <View style={styles.bottomAction}>
        <View>
          <Text style={styles.muted}>Giá vé từ</Text>
          <Text style={styles.priceLarge}>{fromPrice === null ? 'Chọn suất diễn' : formatPrice(fromPrice)}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !currentSession }}
          disabled={!currentSession}
          onPress={() => {
            if (!currentSession) return;
            if (!signedIn) {
              router.push('/login');
              return;
            }
            router.push({
              pathname: '/booking/[sessionId]',
              params: {
                sessionId: currentSession.id,
                eventSlug: event.slug,
                eventTitle: event.title,
                seatMapImageUrl: resolveMediaUrl(event.seatMapImageUrl) ?? '',
              },
            });
          }}
          style={[styles.continueButton, !currentSession && styles.continueDisabled]}>
          <Text style={styles.continueText}>{signedIn ? 'Chọn vé' : 'Đăng nhập để mua'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={() => router.back()} style={styles.backButton}>
        <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} tintColor="#F5F1EF" size={20} />
      </Pressable>
      <Text style={styles.headerTitle}>Chi tiết sự kiện</Text>
      <View style={styles.backButton} />
    </View>
  );
}

function formatPrice(value: number) {
  return `${new Intl.NumberFormat('vi-VN').format(value)}đ`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#171211' },
  header: { height: 52, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18 },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#F5F1EF', fontSize: 14, fontWeight: '700' },
  content: { paddingHorizontal: 18, paddingBottom: 26 },
  hero: { width: '100%', aspectRatio: 1.28, overflow: 'hidden', borderRadius: 16, marginTop: 5, marginBottom: 21, backgroundColor: '#44272A' },
  heroImage: { width: '100%', height: '100%' },
  heroFallback: { flex: 1, justifyContent: 'flex-end', padding: 21, backgroundColor: '#44272A' },
  heroKicker: { color: '#F2B705', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  heroFallbackTitle: { color: '#FFF8EB', fontSize: 28, fontWeight: '900', marginTop: 8 },
  category: { color: '#F4796B', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: '#F5F1EF', fontSize: 26, lineHeight: 32, fontWeight: '800', marginTop: 7 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 13 },
  infoText: { color: '#C9C0BB', fontSize: 12, flex: 1 },
  summary: { color: '#C9C0BB', fontSize: 13, lineHeight: 21, marginTop: 17 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, marginBottom: 12 },
  sectionTitle: { color: '#F5F1EF', fontSize: 17, fontWeight: '800', marginBottom: 12 },
  muted: { color: '#A89E99', fontSize: 12 },
  emptySession: { minHeight: 70, justifyContent: 'center', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#362E2B' },
  session: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 13, padding: 12, marginBottom: 9, borderRadius: 12, borderWidth: 1, borderColor: '#362E2B', backgroundColor: '#211B19' },
  sessionSelected: { borderColor: '#F2B705' },
  sessionDate: { width: 46, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#2A2321' },
  sessionDay: { color: '#F5F1EF', fontSize: 17, fontWeight: '800' },
  sessionMonth: { color: '#A89E99', fontSize: 10, textTransform: 'uppercase' },
  sessionInfo: { flex: 1, gap: 5 },
  sessionTime: { color: '#F5F1EF', fontSize: 14, fontWeight: '700' },
  price: { color: '#F2B705', fontSize: 12, fontWeight: '800' },
  description: { color: '#C9C0BB', fontSize: 13, lineHeight: 21, marginTop: 2 },
  bottomAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 13, paddingBottom: 16, borderTopWidth: 1, borderTopColor: '#362E2B', backgroundColor: '#211B19' },
  priceLarge: { color: '#F2B705', fontSize: 16, fontWeight: '800', marginTop: 3 },
  continueButton: { minHeight: 48, minWidth: 142, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, borderRadius: 10, backgroundColor: '#C02A2A' },
  continueDisabled: { backgroundColor: '#51433F' },
  continueText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  stateTitle: { color: '#F5F1EF', fontSize: 17, fontWeight: '800' },
});