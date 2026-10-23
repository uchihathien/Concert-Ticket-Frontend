import {
  ApiError,
  askSupport,
  getChatThread,
  newIdempotencyKey,
  requestHumanAgent,
  type ActionCard,
  type ChatMessage,
  type Handoff,
} from '@nexaticket/ts-sdk';
import { SymbolView } from 'expo-symbols';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChoicesCardView,
  LoginCardView,
  PaymentCardView,
  ProposalCardView,
} from '@/components/AssistantCards';
import { api } from '@/lib/api';
import { useMobileAuth } from '@/lib/auth-context';
import { assistantSession } from '@/lib/assistant-session';

/**
 * Trợ lý AI cho khách: hỏi đáp, và đặt vé ngay trong cuộc trò chuyện (chip suất/hạng vé → đề xuất →
 * thẻ đơn → thanh toán). Cùng backend và cùng bốn loại thẻ với khung chat web.
 *
 * <h3>Thẻ đi riêng với chữ</h3>
 *
 * Thẻ vẽ từ `action` của phản hồi, không bao giờ từ chữ của mô hình. Sau khi tải lại hội thoại (mở lại
 * màn, quay về từ màn thanh toán), thẻ đang mở lấy từ `ChatThread.action` — server dựng lại từ đề
 * xuất/đơn/chip đã lưu.
 *
 * <h3>Chỉ có ở bản khách</h3>
 *
 * Màn nằm trong nhóm `(customer)`, mà nhóm đó chỉ mở khi `!isStaffApp` (xem `app/_layout.tsx`).
 */
export default function AssistantScreen() {
  const { signedIn } = useMobileAuth();
  const { eventTitle } = useLocalSearchParams<{ eventSlug?: string; eventTitle?: string }>();
  const [sessionId, setSessionId] = useState<string | null>(assistantSession.id);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [card, setCard] = useState<ActionCard | null>(null);
  const [draft, setDraft] = useState(eventTitle ? `Về sự kiện "${eventTitle}": ` : '');
  const [sending, setSending] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  /** Khoá chống trùng của câu đang gửi, giữ qua các lần thử lại — cùng lý do với web. */
  const pendingKey = useRef<{ message: string; key: string } | null>(null);

  const loadThread = useCallback(async (id: string) => {
    try {
      const thread = await getChatThread(api, id);
      setMessages(thread.messages);
      setHandoff(thread.handoff);
      setCard(thread.action);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setNeedsLogin(true);
    }
  }, []);

  // Quay lại màn này (từ màn thanh toán, từ tab khác): tải lại hội thoại và báo thẻ đơn hỏi lại đơn ngay.
  useFocusEffect(
    useCallback(() => {
      if (sessionId) void loadThread(sessionId);
      setRefreshKey((value) => value + 1);
    }, [sessionId, loadThread]),
  );

  // Có phiếu chuyển người thật: hỏi lại hội thoại theo chu kỳ — đó là đường câu trả lời của nhân viên tới.
  useEffect(() => {
    if (!sessionId || !handoff) return;
    const timer = setInterval(() => void loadThread(sessionId), 5000);
    return () => clearInterval(timer);
  }, [sessionId, handoff, loadThread]);

  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timer);
  }, [messages.length, card, sending]);

  if (!signedIn) {
    return (
      <SafeAreaView style={styles.screen}>
        <Header />
        <View style={styles.gate}>
          <Text style={styles.gateTitle}>Đăng nhập để trò chuyện</Text>
          <Text style={styles.gateText}>
            Trợ lý tra được đơn hàng và giữ chỗ cho chính bạn, nên nó cần biết chắc bạn là ai.
          </Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/login')} style={styles.primary}>
            <Text style={styles.primaryText}>Đăng nhập</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  /** Gửi một câu; `text` có mặt khi câu đến từ một nút — khi đó gửi đúng nguyên văn và giữ chữ đang gõ. */
  async function send(text?: string) {
    const fromButton = text !== undefined;
    const message = (text ?? draft).trim();
    if (!message || sending) return;

    const key = pendingKey.current?.message === message ? pendingKey.current.key : newIdempotencyKey();
    pendingKey.current = { message, key };
    if (!fromButton) setDraft('');
    setFailure(null);
    setSending(true);
    // Hiện ngay câu khách vừa gửi; hội thoại thật được tải lại khi có câu trả lời.
    setMessages((current) => [...current, { role: 'USER', content: message, at: new Date().toISOString() }]);
    try {
      const reply = await askSupport(api, { sessionId: sessionId ?? undefined, message }, key);
      pendingKey.current = null;
      if (reply.sessionId !== sessionId) {
        assistantSession.id = reply.sessionId;
        setSessionId(reply.sessionId);
      }
      setNeedsLogin(false);
      await loadThread(reply.sessionId);
      // Thẻ của lượt vừa rồi thắng thẻ dựng lại: cùng một thẻ, nhưng bản trong phản hồi có đủ VietQR.
      setCard(reply.action ?? null);
    } catch (error) {
      setMessages((current) => current.slice(0, -1));
      if (!fromButton) setDraft(message);
      if (error instanceof ApiError && error.status === 401) {
        setNeedsLogin(true);
      } else {
        setFailure(error instanceof ApiError && error.detail ? error.detail : 'Chưa gửi được — bạn thử lại nhé.');
      }
    } finally {
      setSending(false);
    }
  }

  async function askHuman() {
    if (!sessionId) return;
    try {
      setHandoff(await requestHumanAgent(api, sessionId));
      await loadThread(sessionId);
    } catch {
      setFailure('Chưa chuyển được cho nhân viên — bạn thử lại nhé.');
    }
  }

  const waitingForHuman = handoff !== null;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <Header />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView ref={scrollRef} style={styles.flex} contentContainerStyle={styles.thread} keyboardShouldPersistTaps="handled">
          {messages.length === 0 && !sending ? (
            <View style={styles.intro}>
              <Text style={styles.introTitle}>Hỏi mình bất cứ điều gì</Text>
              <Text style={styles.introText}>
                Vé, thanh toán, quy định sự kiện — hoặc nói “cho mình 2 vé …” để đặt vé ngay trong cuộc trò chuyện.
              </Text>
            </View>
          ) : null}

          {messages.map((message, index) => (
            <View
              key={`${message.at}-${index}`}
              style={[
                styles.bubble,
                message.role === 'USER' ? styles.fromUser : message.role === 'AGENT' ? styles.fromAgent : styles.fromBot,
              ]}
            >
              <Text style={styles.who}>{roleLabel(message.role)}</Text>
              <Text style={styles.body}>{message.content}</Text>
            </View>
          ))}

          {sending ? (
            <View style={[styles.bubble, styles.fromBot, styles.typing]}>
              <ActivityIndicator color="#D5FF66" size="small" />
              <Text style={styles.who}>Trợ lý đang soạn câu trả lời…</Text>
            </View>
          ) : null}

          {card?.kind === 'CHOICES' ? (
            <ChoicesCardView card={card} busy={sending} onChoose={(value) => void send(value)} />
          ) : card?.kind === 'BOOKING_PROPOSAL' ? (
            <ProposalCardView
              key={card.id}
              card={card}
              busy={sending}
              onResolved={(next) => setCard(next)}
              onSend={(value) => void send(value)}
            />
          ) : card?.kind === 'PAYMENT' ? (
            <PaymentCardView key={card.orderId} card={card} refreshKey={refreshKey} onRebook={(value) => void send(value)} />
          ) : null}

          {needsLogin ? <LoginCardView /> : null}
        </ScrollView>

        {handoff ? (
          <Text style={styles.banner}>
            {handoff.status === 'WAITING'
              ? 'Đang chờ nhân viên hỗ trợ. Bạn cứ nhắn tiếp — nhân viên đọc được toàn bộ nội dung phía trên.'
              : `${handoff.assignedAgentName ?? 'Nhân viên hỗ trợ'} đang trả lời bạn.`}
          </Text>
        ) : null}
        {failure ? <Text style={styles.failure}>{failure}</Text> : null}

        {eventTitle && !waitingForHuman ? (
          <Pressable
            accessibilityRole="button"
            disabled={sending}
            onPress={() => void send(`Đặt vé ${eventTitle}`)}
            style={styles.quick}
          >
            <Text style={styles.quickText}>Đặt vé {eventTitle}</Text>
          </Pressable>
        ) : null}

        <View style={styles.composer}>
          <TextInput
            accessibilityLabel="Tin nhắn"
            value={draft}
            onChangeText={setDraft}
            placeholder={waitingForHuman ? 'Nhắn cho nhân viên hỗ trợ…' : 'Nhập câu hỏi của bạn…'}
            placeholderTextColor="#6F7B72"
            multiline
            maxLength={2000}
            style={styles.input}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Gửi"
            disabled={sending || !draft.trim()}
            onPress={() => void send()}
            style={[styles.send, (sending || !draft.trim()) && styles.disabled]}
          >
            <SymbolView name={{ ios: 'arrow.up', android: 'send', web: 'send' }} tintColor="#17210D" size={18} />
          </Pressable>
        </View>
        {!waitingForHuman && sessionId ? (
          <Pressable accessibilityRole="button" onPress={() => void askHuman()} style={styles.human}>
            <Text style={styles.humanText}>Gặp nhân viên</Text>
          </Pressable>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={() => router.back()} style={styles.backButton}>
        <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} tintColor="#F1F5F1" size={20} />
      </Pressable>
      <Text style={styles.headerTitle}>Trợ lý AI</Text>
      <View style={styles.backButton} />
    </View>
  );
}

function roleLabel(role: ChatMessage['role']) {
  switch (role) {
    case 'USER':
      return 'Bạn';
    case 'AGENT':
      return 'Nhân viên hỗ trợ';
    default:
      return 'Trợ lý';
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111713' },
  flex: { flex: 1 },
  header: { height: 52, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#344238' },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#F1F5F1', fontSize: 14, fontWeight: '700' },
  thread: { gap: 10, paddingHorizontal: 16, paddingVertical: 16 },
  intro: { padding: 18, borderRadius: 13, borderWidth: 1, borderColor: '#344238', backgroundColor: '#19221B' },
  introTitle: { color: '#F1F5F1', fontSize: 17, fontWeight: '800' },
  introText: { color: '#A6B1A8', fontSize: 13, lineHeight: 20, marginTop: 6 },
  bubble: { maxWidth: '88%', padding: 12, borderRadius: 13 },
  fromUser: { alignSelf: 'flex-end', backgroundColor: '#2A3A2E' },
  fromBot: { alignSelf: 'flex-start', backgroundColor: '#19221B', borderWidth: 1, borderColor: '#344238' },
  fromAgent: { alignSelf: 'flex-start', backgroundColor: '#17291F', borderWidth: 1, borderColor: '#5BD69A' },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  who: { color: '#A6B1A8', fontSize: 11, fontWeight: '700', marginBottom: 3 },
  body: { color: '#F1F5F1', fontSize: 14, lineHeight: 21 },
  banner: { color: '#FFD98A', fontSize: 12, lineHeight: 18, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#2B2616' },
  failure: { color: '#FF8C79', fontSize: 12, paddingHorizontal: 16, paddingTop: 6 },
  quick: { alignSelf: 'flex-start', marginHorizontal: 16, marginTop: 8, paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: '#D5FF66' },
  quickText: { color: '#D5FF66', fontSize: 12, fontWeight: '800' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 16, paddingTop: 10 },
  input: { flex: 1, minHeight: 46, maxHeight: 120, paddingHorizontal: 13, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: '#344238', backgroundColor: '#19221B', color: '#F1F5F1', fontSize: 14 },
  send: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#D5FF66' },
  human: { alignSelf: 'center', paddingVertical: 10 },
  humanText: { color: '#C4CEC5', fontSize: 13, fontWeight: '700' },
  gate: { flex: 1, justifyContent: 'center', gap: 12, paddingHorizontal: 24 },
  gateTitle: { color: '#F1F5F1', fontSize: 22, fontWeight: '900' },
  gateText: { color: '#A6B1A8', fontSize: 14, lineHeight: 21 },
  primary: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#D5FF66' },
  primaryText: { color: '#17210D', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.5 },
});
