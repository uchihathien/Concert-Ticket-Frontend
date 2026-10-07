import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Link, router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMobileAuth } from '@/lib/auth-context';
import { getMobileIdentity, type MobileIdentity } from '@/lib/auth-session';
import { useSavedEvents } from '@/lib/saved-events';

export default function AccountScreen() {
  const { ready, signedIn, signOut } = useMobileAuth();
  const { slugs } = useSavedEvents();
  const [identity, setIdentity] = useState<MobileIdentity | null>(null);

  useEffect(() => {
    let active = true;
    if (!signedIn) return;
    void getMobileIdentity().then((value) => { if (active) setIdentity(value); });
    return () => { active = false; };
  }, [signedIn]);

  const shownIdentity = signedIn ? identity : null;
  const display = shownIdentity?.name || shownIdentity?.email || 'Tài khoản NexaTicket';
  const initials = display
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>NEXATICKET / CÁ NHÂN</Text>
        <Text style={styles.title}>Tài khoản</Text>

        <View style={styles.identity}>
          <View style={styles.avatar}>
            {signedIn && initials ? (
              <Text style={styles.avatarText}>{initials}</Text>
            ) : (
              <SymbolView name={{ ios: 'person.fill', android: 'person', web: 'person' }} tintColor="#D5FF66" size={26} />
            )}
          </View>
          <View style={styles.identityText}>
            {signedIn ? (
              <>
                <Text numberOfLines={1} style={styles.name}>{display}</Text>
                {shownIdentity?.email && shownIdentity.email !== display ? (
                  <Text numberOfLines={1} style={styles.email}>{shownIdentity.email}</Text>
                ) : null}
              </>
            ) : (
              <>
                <Text style={styles.name}>Chào bạn đến với NexaTicket</Text>
                <Text style={styles.email}>Đăng nhập để quản lý vé và đơn hàng.</Text>
              </>
            )}
          </View>
        </View>

        {!signedIn ? (
          <Link href="/login" asChild>
            <Pressable accessibilityRole="button" style={styles.primaryButton}>
              <Text style={styles.primaryText}>{ready ? 'Đăng nhập' : 'Đang kiểm tra phiên...'}</Text>
            </Pressable>
          </Link>
        ) : null}

        <View style={styles.menu}>
          <MenuRow
            icon={{ ios: 'bag.fill', android: 'receipt_long', web: 'receipt_long' }}
            title="Đơn hàng của tôi"
            detail={signedIn ? 'Đơn đã thanh toán và đang chờ' : 'Cần đăng nhập'}
            href={signedIn ? '/orders' : '/login'}
          />
          <MenuRow
            icon={{ ios: 'bookmark.fill', android: 'bookmark', web: 'bookmark' }}
            title="Sự kiện đã lưu"
            detail={slugs.length > 0 ? `${slugs.length} sự kiện` : 'Chưa lưu sự kiện nào'}
            href="/saved"
          />
          <MenuRow
            icon={{ ios: 'questionmark.circle.fill', android: 'help', web: 'help' }}
            title="Trợ giúp & hỗ trợ"
            detail="Câu hỏi thường gặp, liên hệ"
            href="/help"
            last
          />
        </View>

        {signedIn ? (
          <Pressable accessibilityRole="button" onPress={() => void signOut()} style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}>
            <Text style={styles.signOutText}>Đăng xuất</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuRow({ icon, title, detail, href, last = false }: { icon: SymbolViewProps['name']; title: string; detail: string; href: Href; last?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      onPress={() => router.push(href)}
      style={({ pressed }) => [styles.row, !last && styles.rowBorder, pressed && styles.rowPressed]}
    >
      <View style={styles.rowIcon}>
        <SymbolView name={icon} tintColor="#D5FF66" size={18} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDetail}>{detail}</Text>
      </View>
      <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor="#6F7B72" size={16} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111713' },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },
  eyebrow: { color: '#D5FF66', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: '#F1F5F1', fontSize: 28, fontWeight: '800', marginTop: 8 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 22, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#344238', backgroundColor: '#19221B' },
  avatar: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 28, backgroundColor: '#1F2A22', borderWidth: 1, borderColor: '#3B493F' },
  avatarText: { color: '#D5FF66', fontSize: 19, fontWeight: '800' },
  identityText: { flex: 1, minWidth: 0 },
  name: { color: '#F1F5F1', fontSize: 17, fontWeight: '800' },
  email: { color: '#A6B1A8', fontSize: 13, marginTop: 4 },
  primaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 14, borderRadius: 10, backgroundColor: '#D5FF66' },
  primaryText: { color: '#17210D', fontSize: 15, fontWeight: '800' },
  menu: { marginTop: 18, borderRadius: 14, borderWidth: 1, borderColor: '#344238', backgroundColor: '#19221B', overflow: 'hidden' },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#344238' },
  rowPressed: { backgroundColor: '#1F2A22' },
  rowIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#1F2A22' },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { color: '#F1F5F1', fontSize: 15, fontWeight: '700' },
  rowDetail: { color: '#A6B1A8', fontSize: 12, marginTop: 2 },
  signOut: { minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 18, borderRadius: 10, borderWidth: 1, borderColor: '#3B493F' },
  signOutText: { color: '#FF8C79', fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.8 },
});
