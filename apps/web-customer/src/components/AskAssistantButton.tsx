'use client';

import { askSupportAbout } from '@/lib/ask-support';
import styles from './ask-assistant.module.css';

/**
 * "Hỏi trợ lý về sự kiện này" trên trang sự kiện: mở khung chat với sẵn tên sự kiện, để khách không
 * phải gõ lại tên — và để trợ lý tìm đúng sự kiện ngay lần đầu.
 */
export function AskAssistantButton({ eventSlug, eventTitle }: { eventSlug: string; eventTitle: string }) {
  return (
    <button type="button" className={styles.button} onClick={() => askSupportAbout({ eventSlug, eventTitle })}>
      Hỏi trợ lý về sự kiện này
    </button>
  );
}
