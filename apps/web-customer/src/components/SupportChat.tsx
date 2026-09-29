'use client';

import { useSessionState } from '@nexaticket/auth/client';
import {
  ApiError,
  newIdempotencyKey,
  useAskSupport,
  useChatThread,
  useRequestHumanAgent,
  type ChatMessage,
} from '@nexaticket/ts-sdk';
import { Button, Skeleton, cx, formatTime, useToast } from '@nexaticket/ui';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import styles from './support-chat.module.css';

/**
 * Khung chat hỗ trợ: trợ lý trả lời trước, người thật tiếp quản khi cần.
 *
 * <h3>Ba trạng thái, ba giao diện khác nhau</h3>
 *
 * <ol>
 *   <li><b>Chưa đăng nhập.</b> Backend lấy danh tính từ JWT và không bao giờ từ body, nên không có
 *       chế độ khách vãng lai. Hiện lối đăng nhập thay vì một ô nhập sẽ báo lỗi sau khi gõ xong.
 *   <li><b>Trợ lý đang trả lời.</b> Gửi là có câu trả lời ngay trong phản hồi; không hỏi lại
 *       server làm gì.
 *   <li><b>Đã chuyển cho người thật.</b> Trợ lý ngừng hẳn (xem `HandoffUseCase` ở backend), nên ô
 *       nhập phải nói rõ là đang chờ người — hứa trả lời tức thì ở trạng thái này là hứa sai.
 *       Đây cũng là trạng thái duy nhất hội thoại được hỏi lại theo chu kỳ.
 * </ol>
 *
 * <h3>Phiên sống trong `sessionStorage`</h3>
 *
 * Đủ để khách chuyển trang mà không mất mạch hội thoại, và tự hết khi đóng tab — đúng vòng đời của
 * một cuộc hỏi đáp hỗ trợ. Dùng `localStorage` thì một máy dùng chung sẽ mở lại hội thoại của
 * người trước.
 */
export function SupportChat() {
  const { state } = useSessionState();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const toast = useToast();

  const thread = useChatThread(sessionId);
  const ask = useAskSupport();
  const requestHuman = useRequestHumanAgent();
  const listRef = useRef<HTMLOListElement>(null);
  const waited = useElapsedSeconds(ask.isPending);

  /**
   * Khoá chống trùng của câu đang gửi, giữ qua các lần thử lại.
   *
   * Kịch bản nó chặn: mạng rớt SAU khi server đã trả lời xong. Khách thấy lỗi, bấm gửi lại, và
   * cùng một câu hỏi được trả lời hai lần — hai lần tính tiền, hai cặp tin nhắn trùng trong hội
   * thoại. Giữ khoá theo NỘI DUNG câu hỏi chứ không theo lần bấm, nên chỉ lần gửi lại của đúng
   * câu ấy mới dùng lại khoá; sửa chữ rồi gửi là một ý định mới và nhận khoá mới.
   */
  const pendingKey = useRef<{ message: string; key: string } | null>(null);

  // Khôi phục phiên sau khi chuyển trang. Đọc trong effect chứ không lúc khởi tạo state:
  // sessionStorage không tồn tại lúc render ở server, và chạm vào nó ở đó làm hỏng hydrate.
  useEffect(() => {
    const saved = window.sessionStorage.getItem(SESSION_KEY);
    if (saved) setSessionId(saved);
  }, []);

  // Cuộn xuống tin mới nhất. Không có bước này thì câu trả lời vừa tới nằm ngoài tầm nhìn và
  // khách tưởng không có gì xảy ra.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [thread.data?.messages.length]);

  if (state !== 'authenticated') {
    return (
      <div className={styles.gate}>
        <p className={styles.gateText}>
          Trò chuyện với bộ phận hỗ trợ cần đăng nhập — trợ lý tra được đơn hàng của chính bạn, nên
          nó phải biết chắc bạn là ai.
        </p>
        <Link className={styles.gateLink} href="/login?returnUrl=%2Fsupport">
          Đăng nhập để bắt đầu
        </Link>
      </div>
    );
  }

  const messages = thread.data?.messages ?? [];
  const handoff = thread.data?.handoff ?? null;
  // Có phiếu = trợ lý đã ngừng trả lời, bất kể phiếu đang chờ hay đã có người nhận. Ô nhập phải
  // nói rõ là đang nhắn cho người, không cho trợ lý.
  const waitingForHuman = handoff !== null;
  // Dải "đang chờ" CHỈ đúng khi chưa ai nhận. Sau khi nhân viên bấm nhận, câu đó thành sai: khách
  // đang được hỗ trợ mà màn hình vẫn nói là đang chờ, và họ chờ tiếp thay vì nhắn.
  const stillQueued = handoff?.status === 'WAITING';

  async function send() {
    const message = draft.trim();
    if (!message || ask.isPending) return;

    const key =
      pendingKey.current?.message === message ? pendingKey.current.key : newIdempotencyKey();
    pendingKey.current = { message, key };

    setDraft('');
    try {
      const reply = await ask.mutateAsync({
        sessionId: sessionId ?? undefined,
        message,
        idempotencyKey: key,
      });
      pendingKey.current = null;
      // Lượt đầu tiên là lượt backend sinh ra id phiên. Ghi lại ngay, nếu không lượt thứ hai mở
      // một hội thoại mới và trợ lý mất hết ngữ cảnh vừa trao đổi.
      if (reply.sessionId !== sessionId) {
        setSessionId(reply.sessionId);
        window.sessionStorage.setItem(SESSION_KEY, reply.sessionId);
      }
    } catch (error) {
      // Trả lại chữ đã gõ: bắt khách gõ lại một câu dài vì mạng chập là cách chắc chắn làm họ bỏ
      // cuộc giữa chừng. `pendingKey` cố ý KHÔNG xoá — lần gửi lại phải mang đúng khoá ấy.
      setDraft(message);
      toast.showError(error instanceof ApiError ? error : null);
    }
  }

  return (
    <div className={styles.chat}>
      <ol className={styles.messages} ref={listRef}>
        {messages.length === 0 && !ask.isPending ? (
          <li className={styles.intro}>
            Hỏi mình bất cứ điều gì về vé, thanh toán hay quy định của sự kiện. Cần gặp người thật
            thì cứ nói — mình chuyển ngay.
          </li>
        ) : null}

        {messages.map((message, index) => (
          <li
            key={`${message.at}-${index}`}
            className={cx(styles.message, styles[bubbleClass(message.role)])}
          >
            <span className={styles.who}>
              {roleLabel(message.role)}
              <time dateTime={message.at}>{formatTime(message.at)}</time>
            </span>
            <p className={styles.body}>
              {message.role === 'USER' ? message.content : <WithTicketLinks text={message.content} />}
            </p>
          </li>
        ))}

        {ask.isPending ? (
          <li className={cx(styles.message, styles.fromBot)} aria-live="polite">
            <span className={styles.who}>
              Trợ lý đang soạn câu trả lời
              {/*
                Đồng hồ KHÔNG được đọc lên: cả bong bóng này nằm trong vùng aria-live, nên mỗi giây
                trôi qua sẽ là một lần trình đọc màn hình đọc lại cả câu. Phần chữ đứng yên phía
                trên mới là thứ cần thông báo.
              */}
              <span className={styles.clock} aria-hidden="true">
                {waited}s
              </span>
            </span>
            <Skeleton lines={2} />
          </li>
        ) : null}
      </ol>

      {stillQueued ? (
        <p className={styles.handoffBanner} role="status">
          Đang chờ nhân viên hỗ trợ. Bạn cứ nhắn tiếp — nhân viên sẽ đọc được toàn bộ nội dung phía
          trên.
        </p>
      ) : handoff?.assignedAgentName ? (
        /*
          Đã có người nhận: nói TÊN người đó.

          Khách vừa chờ trong hàng đợi, nên thứ họ cần biết đầu tiên là đã có người thật đọc tin của
          mình — và một cái tên nói điều đó rõ hơn mọi cách diễn đạt khác. Dải này thay hẳn câu "đang
          chờ", chứ không nằm thêm bên cạnh: hai câu cùng lúc thì câu nào cũng mất nghĩa.
        */
        <p className={styles.handoffBanner} role="status">
          <strong>{handoff.assignedAgentName}</strong> từ bộ phận hỗ trợ đang trả lời bạn.
        </p>
      ) : null}

      <div className={styles.composer}>
        <label className={styles.label} htmlFor="support-message">
          Tin nhắn
        </label>
        <textarea
          id="support-message"
          className={styles.input}
          rows={2}
          maxLength={2000}
          value={draft}
          placeholder={waitingForHuman ? 'Nhắn cho nhân viên hỗ trợ…' : 'Nhập câu hỏi của bạn…'}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter gửi, Shift+Enter xuống dòng — quy ước quen của mọi khung chat. Thiếu nó thì
            // người dùng phải rời bàn phím để bấm nút sau mỗi câu.
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <div className={styles.actions}>
          <Button onClick={() => void send()} loading={ask.isPending} disabled={!draft.trim()}>
            Gửi
          </Button>

          {/*
            Nút này tồn tại song song với việc nhận ý định trong câu chữ ở backend, và phục vụ một
            nhóm người khác: người đi tìm một cái nút thay vì đoán ra đúng cách diễn đạt.
          */}
          {!waitingForHuman && sessionId ? (
            <Button
              variant="secondary"
              loading={requestHuman.isPending}
              onClick={async () => {
                try {
                  await requestHuman.mutateAsync(sessionId);
                } catch (error) {
                  toast.showError(error instanceof ApiError ? error : null);
                }
              }}
            >
              Gặp nhân viên
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Phiên chat sống trong `sessionStorage`, không phải `localStorage`.
 *
 * Một cuộc hỏi đáp hỗ trợ kết thúc khi khách đóng tab; giữ lâu hơn nghĩa là máy dùng chung sẽ mở
 * lại hội thoại của người trước, trong đó có mã đơn và số tiền.
 */
const SESSION_KEY = 'nexaticket.support.session';

/**
 * Đường dẫn sự kiện trong tin nhắn, dạng `/events/<slug>`.
 *
 * Bám sát: slug của catalog chỉ gồm chữ thường, số và dấu gạch ngang, nên mẫu này không quét lan
 * sang chữ liền sau. Phần `(?![\w-])` chặn việc cắt mất một nửa slug dài.
 */
const EVENT_PATH = /\/events\/([a-z0-9-]+)(?![\w-])/g;

/**
 * Hiện tin nhắn của trợ lý, biến đường dẫn sự kiện thành liên kết bấm được.
 *
 * <h3>Vì sao dựng liên kết từ CHỮ, không từ một danh sách kèm theo</h3>
 *
 * Câu trả lời được lưu vào lịch sử hội thoại dưới dạng chữ. Nếu danh sách sự kiện đi riêng bên cạnh
 * phản hồi của lượt đó, thì sau khi khách chuyển trang và hội thoại được đọc lại từ cơ sở dữ liệu,
 * mọi liên kết biến mất — chỗ bấm chỉ tồn tại đúng một lượt rồi mất. Đường dẫn nằm trong chính chữ
 * thì nó sống đúng bằng tuổi của tin nhắn.
 *
 * <p>Backend là nơi gắn đường dẫn ấy vào (xem `SupportAgentPrompts.withTicketLinks`), nên mọi slug
 * xuất hiện ở đây đều đến từ catalog — không phải slug mô hình tự dựng, loại dẫn tới trang 404.
 */
function WithTicketLinks({ text }: { text: string }) {
  const parts: Array<string | { slug: string }> = [];
  let cursor = 0;

  for (const match of text.matchAll(EVENT_PATH)) {
    const slug = match[1];
    // `noUncheckedIndexedAccess` coi nhóm bắt được là có thể undefined — đúng về kiểu, dù mẫu này
    // luôn có nhóm 1 khi đã khớp. Bỏ qua thay vì dùng `!`: một lần khớp không có slug thì không có
    // gì để dẫn tới, và giữ nguyên chữ vẫn đọc được.
    if (!slug) continue;
    const at = match.index ?? 0;
    if (at > cursor) parts.push(text.slice(cursor, at));
    parts.push({ slug });
    cursor = at + match[0].length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));

  // Không có đường dẫn nào: trả lại đúng chuỗi gốc, không bọc thêm thẻ nào. Phần lớn tin nhắn rơi
  // vào nhánh này — câu trả lời về chính sách không có sự kiện nào để dẫn tới.
  if (parts.length === 1 && typeof parts[0] === 'string') {
    return <>{text}</>;
  }

  return (
    <>
      {parts.map((part, index) =>
        typeof part === 'string' ? (
          part
        ) : (
          <Link key={`${part.slug}-${index}`} href={`/events/${part.slug}`} className={styles.ticketLink}>
            Chọn chỗ và mua vé
          </Link>
        ),
      )}
    </>
  );
}

/**
 * Số giây đã chờ của lượt đang gửi.
 *
 * Đếm bằng mốc thời gian chứ không bằng biến tăng dần: trình duyệt hãm `setInterval` ở tab nền
 * xuống một lần mỗi phút, nên đếm theo nhịp sẽ báo "18s" cho một lượt đã chạy hai phút — con số
 * sai còn tệ hơn không có con số nào.
 */
function useElapsedSeconds(active: boolean): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!active) {
      setSeconds(0);
      return;
    }

    const startedAt = Date.now();
    setSeconds(0);
    const timer = window.setInterval(() => {
      setSeconds(Math.round((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [active]);

  return seconds;
}

function roleLabel(role: ChatMessage['role']): string {
  switch (role) {
    case 'USER':
      return 'Bạn';
    case 'AGENT':
      return 'Nhân viên hỗ trợ';
    default:
      return 'Trợ lý';
  }
}

function bubbleClass(role: ChatMessage['role']): 'fromUser' | 'fromAgent' | 'fromBot' {
  switch (role) {
    case 'USER':
      return 'fromUser';
    case 'AGENT':
      return 'fromAgent';
    default:
      return 'fromBot';
  }
}
