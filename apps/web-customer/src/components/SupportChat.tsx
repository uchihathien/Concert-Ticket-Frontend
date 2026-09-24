'use client';

import { useSessionState } from '@nexaticket/auth/client';
import {
  ApiError,
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
  const waitingForHuman = handoff !== null;

  async function send() {
    const message = draft.trim();
    if (!message || ask.isPending) return;

    setDraft('');
    try {
      const reply = await ask.mutateAsync({ sessionId: sessionId ?? undefined, message });
      // Lượt đầu tiên là lượt backend sinh ra id phiên. Ghi lại ngay, nếu không lượt thứ hai mở
      // một hội thoại mới và trợ lý mất hết ngữ cảnh vừa trao đổi.
      if (reply.sessionId !== sessionId) {
        setSessionId(reply.sessionId);
        window.sessionStorage.setItem(SESSION_KEY, reply.sessionId);
      }
    } catch (error) {
      // Trả lại chữ đã gõ: bắt khách gõ lại một câu dài vì mạng chập là cách chắc chắn làm họ bỏ
      // cuộc giữa chừng.
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
            <p className={styles.body}>{message.content}</p>
          </li>
        ))}

        {ask.isPending ? (
          <li className={cx(styles.message, styles.fromBot)} aria-live="polite">
            <Skeleton lines={2} />
          </li>
        ) : null}
      </ol>

      {waitingForHuman ? (
        <p className={styles.handoffBanner} role="status">
          Đang chờ nhân viên hỗ trợ. Bạn cứ nhắn tiếp — nhân viên sẽ đọc được toàn bộ nội dung phía
          trên.
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
