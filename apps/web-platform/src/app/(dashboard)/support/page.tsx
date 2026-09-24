'use client';

import {
  ApiError,
  useClaimHandoff,
  useHandoffQueue,
  useHandoffThread,
  useReplyToHandoff,
  useResolveHandoff,
  type ChatMessage,
  type Handoff,
} from '@nexaticket/ts-sdk';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  Panel,
  Skeleton,
  cx,
  formatDuration,
  formatTime,
  useToast,
} from '@nexaticket/ui';
import { Bot, Hand, User } from 'lucide-react';
import { useState } from 'react';
import styles from './support.module.css';

/**
 * P-SUPPORT — bàn hỗ trợ.
 *
 * <h3>Vì sao ở web-platform chứ không ở web-admin</h3>
 *
 * Khách chat với <b>nền tảng</b> về đơn hàng của chính họ, và một cuộc chat có thể nhắc tới sự
 * kiện của nhiều tổ chức. Đặt màn hình này ở khu của ban tổ chức nghĩa là họ đọc được hội thoại
 * của khách với tổ chức khác. Quyền `PLATFORM_SUPPORT_HANDLE` cũng được khai ở phạm vi nền tảng vì
 * đúng lý do đó.
 *
 * <h3>Hai cột, một dòng thời gian</h3>
 *
 * Hàng đợi bên trái, hội thoại bên phải. Người trực làm việc bằng cách quét hàng đợi rồi ở lại lâu
 * trong một cuộc — nên hàng đợi phải hiện đủ để chọn (câu hỏi, thời gian chờ) mà không phải mở ra.
 */
export default function SupportPage() {
  const [openId, setOpenId] = useState<string | null>(null);
  const queue = useHandoffQueue();

  return (
    <>
      <PageHeader
        title="Bàn hỗ trợ"
        description="Những cuộc chat mà trợ lý đã chuyển cho người thật."
      />

      <div className={styles.layout}>
        <section className={styles.queue} aria-label="Hàng đợi">
          {queue.isPending ? (
            <Panel>
              <Skeleton lines={4} />
            </Panel>
          ) : queue.isError ? (
            <ErrorState error={null} onRetry={() => void queue.refetch()} />
          ) : queue.data.length === 0 ? (
            <EmptyState
              title="Không có ai đang chờ"
              description="Trợ lý đang xử lý được mọi câu hỏi. Danh sách tự làm mới mỗi vài giây."
            />
          ) : (
            <ul className={styles.queueList}>
              {queue.data.map((handoff) => (
                <li key={handoff.id}>
                  <button
                    type="button"
                    className={cx(styles.queueItem, handoff.id === openId && styles.queueItemOpen)}
                    onClick={() => setOpenId(handoff.id)}
                  >
                    <span className={styles.queueTop}>
                      <StatusBadge handoff={handoff} />
                      {/*
                        Thời gian chờ do backend tính. Đồng hồ máy khách lệch vài phút là chuyện
                        thường, và một phiếu chờ 12 phút hiện thành "3 phút" sẽ bị xử lý sai thứ tự.
                      */}
                      <span className={styles.waiting}>
                        {formatDuration(handoff.waitingSeconds * 1000)}
                      </span>
                    </span>
                    <span className={styles.queueReason}>{handoff.reason}</span>
                    {handoff.lastQuestion ? (
                      <span className={styles.queueQuestion}>“{handoff.lastQuestion}”</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.thread} aria-label="Hội thoại">
          {openId ? (
            <Conversation handoffId={openId} onResolved={() => setOpenId(null)} />
          ) : (
            <EmptyState
              title="Chọn một cuộc trò chuyện"
              description="Bấm vào một phiếu bên trái để đọc toàn bộ nội dung khách đã trao đổi với trợ lý."
            />
          )}
        </section>
      </div>
    </>
  );
}

function Conversation({ handoffId, onResolved }: { handoffId: string; onResolved: () => void }) {
  const thread = useHandoffThread(handoffId);
  const claim = useClaimHandoff();
  const reply = useReplyToHandoff(handoffId);
  const resolve = useResolveHandoff();
  const toast = useToast();
  const [draft, setDraft] = useState('');

  if (thread.isPending) {
    return (
      <Panel>
        <Skeleton lines={6} />
      </Panel>
    );
  }
  if (thread.isError) {
    return <ErrorState error={null} onRetry={() => void thread.refetch()} />;
  }

  const { handoff, messages } = thread.data;
  const mine = handoff.status === 'ASSIGNED';

  async function send() {
    const text = draft.trim();
    if (!text) return;
    try {
      await reply.mutateAsync(text);
      setDraft('');
    } catch (error) {
      toast.showError(asApiError(error));
    }
  }

  return (
    <Panel className={styles.conversation}>
      <header className={styles.threadHead}>
        <StatusBadge handoff={handoff} />
        <span className={styles.threadReason}>{handoff.reason}</span>
      </header>

      <ol className={styles.messages}>
        {messages.map((message, index) => (
          <li
            key={`${message.at}-${index}`}
            className={cx(styles.message, styles[bubbleClass(message.role)])}
          >
            <span className={styles.messageWho}>
              <RoleIcon role={message.role} />
              {roleLabel(message.role)}
              <time dateTime={message.at}>{formatTime(message.at)}</time>
            </span>
            <p className={styles.messageBody}>{message.content}</p>
          </li>
        ))}
      </ol>

      {mine ? (
        <div className={styles.composer}>
          <label className={styles.composerLabel} htmlFor="support-reply">
            Trả lời khách
          </label>
          <textarea
            id="support-reply"
            className={styles.composerInput}
            rows={3}
            value={draft}
            maxLength={4000}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Nhập câu trả lời…"
          />
          <div className={styles.composerActions}>
            <Button onClick={() => void send()} loading={reply.isPending} disabled={!draft.trim()}>
              Gửi
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await resolve.mutateAsync(handoffId);
                  // Đóng hội thoại sau khi xong: phiếu đã rời hàng đợi, và giữ nó mở là mời người
                  // trực gõ tiếp vào một cuộc không còn ai đọc.
                  onResolved();
                } catch (error) {
                  toast.showError(asApiError(error));
                }
              }}
              loading={resolve.isPending}
            >
              Đánh dấu đã xong
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.claimBar}>
          <p className={styles.claimHint}>
            Nhận phiếu này trước khi trả lời. Nếu người khác vừa nhận, phiếu sẽ rời khỏi hàng đợi.
          </p>
          <Button
            onClick={async () => {
              try {
                await claim.mutateAsync(handoffId);
              } catch (error) {
                // 409 ở đây là câu trả lời ĐÚNG, không phải sự cố: người khác nhanh hơn nửa giây.
                // Nên nó hiện ở giọng thông báo, và phiếu được gỡ khỏi màn hình thay vì mời thử lại.
                const taken = error instanceof ApiError && error.code === 'HANDOFF_ALREADY_TAKEN';
                if (taken) {
                  toast.show({ tone: 'info', message: 'Phiếu này vừa được người khác nhận.' });
                  onResolved();
                } else {
                  toast.showError(asApiError(error));
                }
              }
            }}
            loading={claim.isPending}
          >
            Nhận phiếu
          </Button>
        </div>
      )}
    </Panel>
  );
}

/** `catch` cho ra `unknown`; toast cần hình dạng lỗi của API. Không phải lỗi API thì trả null. */
function asApiError(error: unknown): ApiError | null {
  return error instanceof ApiError ? error : null;
}

function StatusBadge({ handoff }: { handoff: Handoff }) {
  if (handoff.status === 'ASSIGNED') {
    return <Badge tone="success">Đang xử lý</Badge>;
  }
  // Nguồn chuyển tiếp đổi cách đọc phiếu: khách tự đòi gặp người thì thường đang bực, còn trợ lý
  // bỏ cuộc thì là một lỗ hổng tri thức cần vá.
  return (
    <Badge tone={handoff.trigger === 'CUSTOMER_REQUEST' ? 'warn' : 'neutral'}>
      {handoff.trigger === 'CUSTOMER_REQUEST' ? 'Khách yêu cầu' : 'Trợ lý chuyển'}
    </Badge>
  );
}

function RoleIcon({ role }: { role: ChatMessage['role'] }) {
  const size = 14;
  if (role === 'USER') return <User size={size} aria-hidden="true" />;
  if (role === 'AGENT') return <Hand size={size} aria-hidden="true" />;
  return <Bot size={size} aria-hidden="true" />;
}

function roleLabel(role: ChatMessage['role']): string {
  switch (role) {
    case 'USER':
      return 'Khách';
    case 'AGENT':
      return 'Nhân viên';
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
