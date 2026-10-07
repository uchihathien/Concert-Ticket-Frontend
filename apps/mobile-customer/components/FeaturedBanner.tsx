import type { PublicEventCard } from '@nexaticket/ts-sdk';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { resolveMediaUrl } from '@/lib/media-url';

const AUTO_ADVANCE_MS = 5000;

/**
 * Banner sự kiện nổi bật ở đầu tab Khám phá — bản app của hero xoay vòng trên web
 * (ui-direction.md §1: "Hero banner xoay vòng 3–5 slide, tự chạy, có chấm điều hướng").
 *
 * Thay cho câu chào "Tối nay, bạn muốn đi đâu?": màn đầu nên là NỘI DUNG (sự kiện bấm được) chứ
 * không phải một dòng chữ trang trí (ui-direction.md §4). Tự chuyển slide, dừng khi người dùng
 * đang vuốt, và chấm chỉ báo bấm được để nhảy thẳng tới slide.
 */
export function FeaturedBanner({ events, width }: { events: PublicEventCard[]; width: number }) {
  const listRef = useRef<FlatList<PublicEventCard>>(null);
  const [index, setIndex] = useState(0);
  const dragging = useRef(false);
  const slides = events.slice(0, 5);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = setInterval(() => {
      if (dragging.current) return;
      setIndex((current) => {
        const next = (current + 1) % slides.length;
        listRef.current?.scrollToOffset({ offset: next * width, animated: true });
        return next;
      });
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [slides.length, width]);

  if (slides.length === 0) return null;

  const onMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    dragging.current = false;
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  return (
    <View style={styles.wrap}>
      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(event) => event.slug}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={[styles.list, { width }]}
        onScrollBeginDrag={() => { dragging.current = true; }}
        onMomentumScrollEnd={onMomentumEnd}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item }) => <Slide event={item} width={width} />}
      />
      {slides.length > 1 ? (
        <View style={styles.dots}>
          {slides.map((event, i) => (
            <Pressable
              key={event.slug}
              accessibilityRole="button"
              accessibilityLabel={`Xem banner ${i + 1}: ${event.title}`}
              hitSlop={8}
              onPress={() => {
                setIndex(i);
                listRef.current?.scrollToOffset({ offset: i * width, animated: true });
              }}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Slide({ event, width }: { event: PublicEventCard; width: number }) {
  const open = () => router.push({ pathname: '/events/[slug]', params: { slug: event.slug } });
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Sự kiện nổi bật: ${event.title}`} onPress={open} style={[styles.slide, { width }]}>
      {event.posterUrl ? (
        <Image source={{ uri: resolveMediaUrl(event.posterUrl) }} resizeMode="cover" style={StyleSheet.absoluteFill} />
      ) : null}
      {/* Hai lớp phủ thay gradient (không thêm thư viện): phủ nhẹ toàn ảnh + dải tối ở đáy cho chữ. */}
      <View style={styles.shade} />
      <View style={styles.bottomShade} />
      <View style={styles.body}>
        {event.city ? <Text style={styles.kicker}>{event.city.toUpperCase()}</Text> : null}
        <Text numberOfLines={2} style={styles.title}>{event.title}</Text>
        <Text numberOfLines={1} style={styles.meta}>
          {[event.nextSessionAt ? formatDate(event.nextSessionAt) : null, event.venueName].filter(Boolean).join(' · ')}
        </Text>
        <Pressable accessibilityRole="button" onPress={open} style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
          <Text style={styles.ctaText}>Mua vé ngay</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

const styles = StyleSheet.create({
  wrap: { marginTop: 18 },
  list: { flexGrow: 0, borderRadius: 18 },
  slide: { height: 220, justifyContent: 'flex-end', overflow: 'hidden', borderRadius: 18, backgroundColor: '#19221B' },
  shade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(13,18,15,0.18)' },
  bottomShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%', backgroundColor: 'rgba(13,18,15,0.72)' },
  body: { padding: 16, gap: 4 },
  kicker: { color: '#D5FF66', fontSize: 11, fontWeight: '900', letterSpacing: 1.3 },
  title: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', lineHeight: 27 },
  meta: { color: '#C4CEC5', fontSize: 13 },
  cta: { alignSelf: 'flex-start', minHeight: 40, justifyContent: 'center', paddingHorizontal: 16, marginTop: 8, borderRadius: 999, backgroundColor: '#D5FF66' },
  ctaPressed: { backgroundColor: '#C4F04F' },
  ctaText: { color: '#17210D', fontSize: 14, fontWeight: '800' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 10 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#3B493F' },
  dotActive: { width: 22, backgroundColor: '#D5FF66' },
});
