/**
 * Nội dung trợ giúp. Năm câu đầu chép nguyên từ trang Hỗ trợ của web-customer
 * (app/(site)/support/page.tsx) để hai nơi trả lời giống nhau; các câu sau mô tả đúng luồng trong
 * app. Sửa một bên thì sửa cả bên kia.
 */
export const HELP_FAQ: { question: string; answer: string }[] = [
  {
    question: 'Tôi đã chuyển khoản nhưng chưa thấy vé, phải làm gì?',
    answer:
      'Giữa lúc hệ thống nhận tiền và lúc vé được phát hành có một khoảng ngắn, thường dưới một giây. Nếu quá vài phút mà mục “Vé của tôi” vẫn trống, hãy giữ lại mã tra cứu hiện trên màn hình đơn hàng và liên hệ hỗ trợ — mã đó dẫn thẳng tới đúng giao dịch của bạn.',
  },
  {
    question: 'Hết thời gian giữ chỗ thì sao?',
    answer:
      'Chỗ được trả lại cho người khác mua và bạn cần chọn lại. Đồng hồ đếm ngược trên màn hình chạy theo giờ máy chủ, nên nó không bị lệch kể cả khi đồng hồ máy bạn sai.',
  },
  {
    question: 'Tôi bấm “Giữ chỗ” hai lần, có bị tạo hai đơn không?',
    answer:
      'Không. Mỗi lần bấm được gắn một khoá chống trùng, nên các lần gửi lại của cùng một thao tác được hệ thống nhận ra là một.',
  },
  {
    question: 'Ảnh chụp màn hình mã QR có vào cửa được không?',
    answer:
      'Không. Mã QR có chữ ký và có hạn, chỉ dùng được một lần tại đúng suất diễn ghi trên vé. Mã đã quét sẽ bị từ chối ở lần sau.',
  },
  {
    question: 'Tôi muốn bán vé trên NexaTicket thì làm thế nào?',
    answer:
      'Tài khoản tổ chức do quản trị nền tảng tạo sau khi thẩm định, không có luồng tự đăng ký. Liên hệ để được hướng dẫn thủ tục.',
  },
  {
    question: 'Mua vé gồm những bước nào?',
    answer:
      'Chọn sự kiện → chọn suất diễn → chọn khu và số lượng vé → đồng ý điều khoản → bấm “Giữ chỗ và thanh toán”. Chỗ được giữ trong ít phút; bạn quét mã QR thanh toán và chuyển khoản trong thời gian đó. Vé được phát ngay khi hệ thống nhận tiền.',
  },
  {
    question: 'Tôi xem vé và mã vào cửa ở đâu?',
    answer:
      'Mở tab “Vé của tôi”. Mỗi vé ghi tên sự kiện, suất diễn, địa điểm, khu và ghế. Chạm vào vé để hiện mã QR và đưa cho nhân viên soát vé ở cửa.',
  },
  {
    question: 'Xem lại đơn hàng đã thanh toán ở đâu?',
    answer:
      'Vào Tài khoản → Đơn hàng của tôi. Mặc định hiện các đơn đã thanh toán; chọn “Tất cả” để xem cả đơn đang chờ thanh toán, quá hạn hoặc đã huỷ. Đơn còn chờ thanh toán có thể mở lại để trả tiếp mà không tạo đơn mới.',
  },
  {
    question: 'Một lần được mua tối đa bao nhiêu vé?',
    answer:
      'Mỗi suất diễn có giới hạn số vé cho một tài khoản do ban tổ chức đặt. Màn chọn chỗ hiện “Bạn còn mua được … vé cho suất này” trước khi bạn giữ chỗ.',
  },
  {
    question: 'Sự kiện đã lưu được giữ ở đâu?',
    answer:
      'Danh sách sự kiện đã lưu nằm trên thiết bị bạn đang dùng — chưa đồng bộ giữa điện thoại và website. Gỡ app hoặc xoá dữ liệu trình duyệt sẽ xoá danh sách này.',
  },
];
