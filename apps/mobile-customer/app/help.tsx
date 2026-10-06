import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { HELP_FAQ } from '@/lib/help-content';

// Cùng nguồn cấu hình với web (NEXT_PUBLIC_SUPPORT_*). Không khai thì không hiện — không bịa số.
const supportEmail = process.env.EXPO_PUBLIC_SUPPORT_EMAIL;
const supportHotline = process.env.EXPO_PUBLIC_SUPPORT_HOTLINE;

export default function HelpScreen() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenHeader title="Trợ giúp & hỗ trợ" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.section}>LIÊN HỆ</Text>
        <View style={styles.card}>
          {supportHotline ? (
            <ContactRow icon={{ ios: 'phone.fill', android: 'call', web: 'call' }} label="Hotline" value={supportHotline} onPress={() => void Linking.openURL(`tel:${supportHotline.replace(/\s/g, '')}`)} />
          ) : null}
          {supportEmail ? (
            <ContactRow icon={{ ios: 'envelope.fill', android: 'mail', web: 'mail' }} label="Email" value={supportEmail} onPress={() => void Linking.openURL(`mailto:${supportEmail}`)} />
          ) : null}
          <View style={styles.info}>
            <SymbolView name={{ ios: 'bubble.left.and.bubble.right.fill', android: 'forum', web: 'forum' }} tintColor="#F2B705" size={18} />
            <Text style={styles.infoText}>
              Trò chuyện với trợ lý hỗ trợ tại mục Hỗ trợ trên website NexaTicket — trợ lý trả lời ngay và chuyển sang nhân viên khi cần.
            </Text>
          </View>
          <View style={styles.info}>
            <SymbolView name={{ ios: 'number', android: 'tag', web: 'tag' }} tintColor="#F2B705" size={18} />
            <Text style={styles.infoText}>
              Khi báo sự cố, gửi kèm mã đơn (dạng NT-…) hoặc mã tra cứu hiện trên màn hình lỗi để được xử lý nhanh nhất.
            </Text>
          </View>
        </View>

        <Text style={styles.section}>CÂU HỎI THƯỜNG GẶP</Text>
        <View style={styles.card}>
          {HELP_FAQ.map((item, index) => {
            const expanded = open === index;
            return (
              <View key={item.question} style={[styles.faq, index < HELP_FAQ.length - 1 && styles.faqBorder]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  onPress={() => setOpen(expanded ? null : index)}
                  style={styles.question}
                >
                  <Text style={styles.questionText}>{item.question}</Text>
                  <SymbolView
                    name={expanded ? { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' } : { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }}
                    tintColor="#A89E99"
                    size={16}
                  />
                </Pressable>
                {expanded ? <Text style={styles.answer}>{item.answer}</Text> : null}
              </View>
            );
          })}
        </View>

        <Text style={styles.footnote}>Điều khoản sử dụng và Chính sách bảo mật (gồm quy định hoàn, đổi vé) xem trên website NexaTicket.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ContactRow({ icon, label, value, onPress }: { icon: React.ComponentProps<typeof SymbolView>['name']; label: string; value: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} onPress={onPress} style={({ pressed }) => [styles.contact, pressed && styles.pressed]}>
      <SymbolView name={icon} tintColor="#F2B705" size={18} />
      <View style={{ flex: 1 }}>
        <Text style={styles.contactLabel}>{label}</Text>
        <Text style={styles.contactValue}>{value}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#171211' },
  content: { padding: 16, paddingBottom: 40 },
  section: { color: '#A89E99', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginTop: 8, marginBottom: 8 },
  card: { borderRadius: 14, borderWidth: 1, borderColor: '#362E2B', backgroundColor: '#211B19', paddingHorizontal: 14, marginBottom: 14 },
  contact: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#362E2B' },
  contactLabel: { color: '#A89E99', fontSize: 12 },
  contactValue: { color: '#F5F1EF', fontSize: 15, fontWeight: '700', marginTop: 2 },
  info: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
  infoText: { flex: 1, color: '#C9C0BB', fontSize: 13, lineHeight: 20 },
  faq: { paddingVertical: 4 },
  faqBorder: { borderBottomWidth: 1, borderBottomColor: '#362E2B' },
  question: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10 },
  questionText: { flex: 1, color: '#F5F1EF', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  answer: { color: '#C9C0BB', fontSize: 13, lineHeight: 20, paddingBottom: 12 },
  footnote: { color: '#7A706B', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 4 },
  pressed: { opacity: 0.8 },
});
