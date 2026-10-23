/**
 * Mở khung chat hỗ trợ từ một trang khác, kèm ngữ cảnh sự kiện.
 *
 * Khung chat sống trong `SupportLauncher` (một lần cho cả trang), còn nút "Hỏi trợ lý" nằm sâu trong
 * trang sự kiện — hai nơi không chung cây component. Một sự kiện trình duyệt nối hai đầu mà không phải
 * kéo một context React qua cả layout chỉ cho một nút.
 */
export const ASK_SUPPORT_EVENT = 'nexaticket:ask-support';

export interface AskSupportContext {
  eventSlug: string;
  eventTitle: string;
}

export function askSupportAbout(context: AskSupportContext): void {
  window.dispatchEvent(new CustomEvent<AskSupportContext>(ASK_SUPPORT_EVENT, { detail: context }));
}
