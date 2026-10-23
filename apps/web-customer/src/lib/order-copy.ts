import type { Order } from '@nexaticket/ts-sdk';

/**
 * Câu chữ cho một đơn đã đóng — dùng chung giữa trang thanh toán và thẻ thanh toán trong chat.
 *
 * Hai màn hình nói về cùng một trạng thái đơn phải nói cùng một câu: khách đọc "Đơn đã bị huỷ" trong
 * chat rồi mở trang đơn thấy một cách diễn đạt khác sẽ tưởng là hai chuyện khác nhau.
 */
export function closedTitle(status: Order['status']): string {
  if (status === 'EXPIRED') return 'Đơn đã hết hạn thanh toán';
  if (status === 'CANCELLED') return 'Đơn đã bị huỷ';
  if (status === 'MANUAL_REVIEW') return 'Tiền tới sau khi đơn hết hạn';
  return 'Đơn đã được hoàn tiền';
}

/**
 * Dòng giải thích dưới tiêu đề.
 *
 * MANUAL_REVIEW nói thẳng là tiền đã tới: câu "chỗ đã mở lại cho người khác" một mình sẽ khiến người
 * vừa chuyển khoản nghĩ tiền của họ biến mất, và họ sẽ chuyển lần thứ hai.
 */
export function closedNote(status: Order['status']): string {
  return status === 'MANUAL_REVIEW'
    ? 'Chúng tôi đã nhận được khoản chuyển khoản của bạn, nhưng nó tới sau khi đơn hết hạn và chỗ đã được mở lại. Bộ phận hỗ trợ sẽ liên hệ để hoàn tiền cho bạn.'
    : 'Chỗ đã được mở lại cho người khác. Nếu bạn vẫn muốn mua, hãy chọn chỗ lại từ đầu.';
}
