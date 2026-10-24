import {
  ApiError,
  cancelOrder,
  cancelProposal,
  confirmProposal,
  getOrder,
  type ActionCard,
  type BookingProposalCard,
  type ChoicesCard,
  type Order,
  type PaymentCard,
} from '@nexaticket/ts-sdk';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '@/lib/api';

/**
 * Thẻ hành động trong màn Trợ lý — cùng bốn loại với khung chat web (`SupportChat`): chip lựa chọn,
 * đề xuất đặt vé, thẻ đơn, và thẻ mời đăng nhập lại.
 *
 * Chữ và số trên thẻ là dữ liệu backend dựng từ catalog/ordering, không phải câu của mô hình. Đơn chỉ
 * ra đời khi khách bấm Đồng ý (ADR-2001); bấm hai lần vẫn một đơn vì khoá chống trùng theo id đề xuất.
 */

/** Câu nút "Đổi lựa chọn" gửi đi — server nhận đúng câu này (ChatBookingFlow). */
export const CHANGE_SELECTION = 'Đổi lựa chọn';

export function ChoicesCardView({
  card,
  busy,
  onChoose,
}: {
  card: ChoicesCard;
  busy: boolean;
  onChoose: (value: string) => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{card.prompt}</Text>
      <View style={styles.chips}>
        {card.options.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={option.hint ? `${option.label}. ${option.hint}` : option.label}
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={() => onChoose(option.value)}
            style={({ pressed }) => [styles.chip, pressed && styles.chipPressed, busy && styles.disabled]}
          >
            <Text style={styles.chipLabel}>{option.label}</Text>
            {option.hint ? <Text style={styles.chipHint}>{option.hint}</Text> : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

type ProposalState = 'open' | 'confirming' | 'expired' | { rejected: string };

export function ProposalCardView({
  card,
  busy,
  onResolved,
  onSend,
}: {
  card: BookingProposalCard;
  busy: boolean;
  /** Thẻ kế tiếp sau khi bấm: thẻ đơn (Đồng ý) hoặc `null` (Huỷ). */
  onResolved: (next: ActionCard | null) => void;
  onSend: (text: string) => void;
}) {
  const [picked, setPicked] = useState<ProposalState>('open');
  const remaining = useCountdown(card.expiresAt);
  // Đồng hồ về 0 thì thẻ hết hạn — suy ra, không gọi API: server tự biết, và một lời gọi chỉ để nhận
  // 410 là một lời gọi vô ích.
  const state: ProposalState = picked === 'open' && remaining === 0 ? 'expired' : picked;

  async function onConfirm() {
    setPicked('confirming');
    try {
      const confirmation = await confirmProposal(api, card.id);
      onResolved(confirmation.action);
    } catch (error) {
      if (!(error instanceof ApiError)) {
        setPicked('open');
        return;
      }
      if (error.code === 'PROPOSAL_ALREADY_CONFIRMED') {
        // Bấm hai lần, hoặc đã bấm ở web: đơn đã có — hiện lại thẻ đơn từ meta.
        const action = error.meta?.action as PaymentCard | undefined;
        onResolved(action?.kind === 'PAYMENT' ? action : null);
      } else if (error.code === 'PROPOSAL_EXPIRED') {
        setPicked('expired');
      } else if (error.code === 'BOOKING_REJECTED') {
        setPicked({ rejected: error.detail ?? 'Không giữ được chỗ cho đề xuất này.' });
      } else {
        setPicked('open');
      }
    }
  }

  async function onCancel() {
    try {
      await cancelProposal(api, card.id);
    } catch {
      // 404/410: đề xuất đã không còn — đúng điều khách muốn.
    }
    onResolved(null);
  }

  const locked = busy || state !== 'open';

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>ĐỀ XUẤT ĐẶT VÉ</Text>
      <Text style={styles.cardBody}>{card.summary}</Text>
      <Text style={styles.total}>Tạm tính {formatPrice(card.totalVnd)}</Text>

      {state === 'expired' ? (
        <Text style={styles.cardNote}>Đề xuất đã hết hạn — bạn hỏi lại trợ lý nhé.</Text>
      ) : typeof state === 'object' ? (
        <>
          <Text style={styles.cardError}>{state.rejected}</Text>
          <SecondaryButton label="Chọn hạng khác" disabled={busy} onPress={() => onSend(CHANGE_SELECTION)} />
        </>
      ) : (
        <>
          <Text style={[styles.timer, remaining <= 60 && styles.timerWarn]}>Còn {formatMmSs(remaining)}</Text>
          <PrimaryButton label="Xác nhận đặt" loading={state === 'confirming'} disabled={locked} onPress={() => void onConfirm()} />
          <View style={styles.row}>
            <SecondaryButton label="Đổi lựa chọn" disabled={locked} onPress={() => onSend(CHANGE_SELECTION)} />
            <SecondaryButton label="Huỷ" disabled={locked} onPress={() => void onCancel()} />
          </View>
        </>
      )}
    </View>
  );
}

/**
 * Thẻ đơn: tự hỏi lại đơn mỗi 5 giây khi còn chờ tiền (cùng nhịp với màn checkout). `refreshKey` đổi
 * khi khách quay lại màn Trợ lý từ màn thanh toán, để thẻ cập nhật ngay thay vì chờ nhịp kế tiếp.
 */
export function PaymentCardView({
  card,
  refreshKey,
  onRebook,
}: {
  card: PaymentCard;
  refreshKey: number;
  onRebook: (text: string) => void;
}) {
  const [order, setOrder] = useState<Order | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const status = order?.status ?? card.status ?? 'AWAITING_PAYMENT';
  const deadline = order?.paymentExpiresAt ?? card.paymentExpiresAt;
  const remaining = useCountdown(deadline);

  useEffect(() => {
    let active = true;
    let done = false;
    const load = async () => {
      if (done) return;
      try {
        const fresh = await getOrder(api, card.orderId);
        if (!active) return;
        setOrder(fresh);
        done = fresh.status !== 'AWAITING_PAYMENT';
      } catch {
        // Mạng chập: giữ trạng thái đang hiện, nhịp sau hỏi lại.
      }
    };
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [card.orderId, refreshKey]);

  async function onCancelHold() {
    setCancelling(true);
    try {
      await cancelOrder(api, card.orderId);
      setOrder(await getOrder(api, card.orderId));
    } catch {
      // Không huỷ được (đơn vừa được trả, mạng hỏng): thẻ tự hỏi lại đơn ở nhịp sau.
    } finally {
      setCancelling(false);
    }
  }

  const paid = status === 'PAID';
  const closed = status !== 'AWAITING_PAYMENT' && !paid;

  return (
    <View style={[styles.card, paid && styles.cardPaid, closed && styles.cardClosed]}>
      <Text style={styles.cardTitle}>ĐƠN {card.orderNumber}</Text>
      {card.eventTitle ? <Text style={styles.cardBody}>{card.eventTitle}</Text> : null}
      {card.sessionStartsAt || card.venueName ? (
        <Text style={styles.cardMeta}>
          {[card.sessionStartsAt ? formatDateTime(card.sessionStartsAt) : null, card.venueName]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      ) : null}
      {card.lines?.map((line) => (
        <Text key={line.zoneName} style={styles.cardMeta}>
          {line.quantity} × {line.zoneName}
        </Text>
      ))}
      <Text style={styles.total}>{formatPrice(order?.totalVnd ?? card.totalVnd)}</Text>

      {paid ? (
        <>
          <Text style={styles.paidText}>Đã thanh toán — vé đã có trong Vé của tôi</Text>
          <PrimaryButton label="Xem vé" onPress={() => router.push('/tickets')} />
        </>
      ) : closed ? (
        <>
          <Text style={styles.cardNote}>{closedLabel(status)}</Text>
          {card.eventTitle && (status === 'EXPIRED' || status === 'CANCELLED') ? (
            <SecondaryButton label="Đặt lại" onPress={() => onRebook(`Đặt lại vé ${card.eventTitle}`)} />
          ) : null}
        </>
      ) : (
        <>
          {deadline ? (
            <Text style={[styles.timer, remaining <= 120 && styles.timerWarn]}>Còn {formatMmSs(remaining)} để thanh toán</Text>
          ) : null}
          <PrimaryButton
            label="Thanh toán ngay"
            onPress={() =>
              router.push({
                pathname: '/checkout/[orderId]',
                params: { orderId: card.orderId, orderNumber: card.orderNumber },
              })
            }
          />
          <SecondaryButton label="Huỷ giữ chỗ" loading={cancelling} onPress={() => void onCancelHold()} />
        </>
      )}
    </View>
  );
}

/** Phiên đăng nhập hết hạn giữa cuộc chat (401): mời đăng nhập lại, hội thoại vẫn còn. */
export function LoginCardView() {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>CẦN ĐĂNG NHẬP LẠI</Text>
      <Text style={styles.cardBody}>Phiên đăng nhập đã hết hạn. Đăng nhập lại để mình tiếp tục giữ chỗ và tra đơn cho bạn.</Text>
      <PrimaryButton label="Đăng nhập" onPress={() => router.push('/login')} />
    </View>
  );
}

function PrimaryButton({ label, onPress, loading = false, disabled = false }: { label: string; onPress: () => void; loading?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [styles.primary, (disabled || loading) && styles.disabled, pressed && styles.pressed]}
    >
      {loading ? <ActivityIndicator color="#17210D" /> : <Text style={styles.primaryText}>{label}</Text>}
    </Pressable>
  );
}

function SecondaryButton({ label, onPress, loading = false, disabled = false }: { label: string; onPress: () => void; loading?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [styles.secondary, (disabled || loading) && styles.disabled, pressed && styles.pressed]}
    >
      {loading ? <ActivityIndicator color="#D5FF66" /> : <Text style={styles.secondaryText}>{label}</Text>}
    </Pressable>
  );
}

/**
 * Số giây còn tới một mốc. Lưu "bây giờ" và tính lại từ mốc mỗi lần vẽ — không đếm biến tăng dần, vì
 * app ở nền bị hãm nhịp và một biến đếm sẽ báo sai.
 */
function useCountdown(deadline: string | null | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return deadline ? Math.max(0, Math.round((Date.parse(deadline) - now) / 1000)) : 0;
}

function closedLabel(status: Order['status']) {
  switch (status) {
    case 'EXPIRED':
      return 'Đơn đã quá hạn thanh toán — chỗ đã được mở lại.';
    case 'CANCELLED':
      return 'Đơn đã được huỷ — chỗ đã được mở lại.';
    case 'REFUNDED':
      return 'Đơn đã được hoàn tiền.';
    case 'MANUAL_REVIEW':
      return 'Thanh toán đang được đối soát — nhân viên sẽ liên hệ bạn.';
    default:
      return '';
  }
}

function formatMmSs(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function formatPrice(value: number) {
  return `${new Intl.NumberFormat('vi-VN').format(value)}đ`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

const styles = StyleSheet.create({
  card: { gap: 9, padding: 15, borderRadius: 13, borderWidth: 1, borderColor: '#D5FF66', backgroundColor: '#19221B' },
  cardPaid: { borderColor: '#5BD69A', backgroundColor: '#17291F' },
  cardClosed: { borderColor: '#3B493F', opacity: 0.85 },
  cardTitle: { color: '#A6B1A8', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  cardBody: { color: '#F1F5F1', fontSize: 15, fontWeight: '700', lineHeight: 21 },
  cardMeta: { color: '#A6B1A8', fontSize: 12 },
  cardNote: { color: '#C4CEC5', fontSize: 13, lineHeight: 19 },
  cardError: { color: '#FF8C79', fontSize: 13, lineHeight: 19 },
  total: { color: '#D5FF66', fontSize: 16, fontWeight: '900' },
  paidText: { color: '#5BD69A', fontSize: 14, fontWeight: '800' },
  timer: { color: '#D5FF66', fontSize: 13, fontWeight: '800' },
  timerWarn: { color: '#FFB86B' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#3B493F', backgroundColor: '#1F2A22' },
  chipPressed: { borderColor: '#D5FF66' },
  chipLabel: { color: '#F1F5F1', fontSize: 14, fontWeight: '800' },
  chipHint: { color: '#A6B1A8', fontSize: 11, marginTop: 2 },
  row: { flexDirection: 'row', gap: 8 },
  primary: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#D5FF66' },
  primaryText: { color: '#17210D', fontSize: 14, fontWeight: '900' },
  secondary: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#3B493F' },
  secondaryText: { color: '#D5FF66', fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
});
