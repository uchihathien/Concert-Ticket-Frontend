import type { Metadata } from 'next';
import { SupportChat } from '@/components/SupportChat';
import styles from '../legal.module.css';

export const metadata: Metadata = {
  title: 'Hỗ trợ — NexaTicket',
  description: 'Câu hỏi thường gặp về đặt vé, thanh toán và soát vé.',
};

/**
 * Trang hỗ trợ.
 *
 * Dùng `<details>` thay vì accordion tự viết: mở/đóng, bàn phím và tìm-trong-trang của trình
 * duyệt đều hoạt động sẵn, và nó không cần một dòng JavaScript nào.
 *
 * Khung chat ở đầu trang là kênh liên hệ thật: trợ lý trả lời trước, và chuyển sang người thật khi
 * khách yêu cầu hoặc khi nó không xử lý được. Phần FAQ ở dưới vẫn giữ — nó trả lời được ngay,
 * không cần đăng nhập, và đọc được cả khi JavaScript chưa tải xong.
 */
const FAQ = [
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
  // Năm câu dưới cũng có trong app điện thoại (apps/mobile-customer/lib/help-content.ts) — sửa một
  // bên thì sửa cả bên kia để hai nơi trả lời giống nhau.
  {
    question: 'Mua vé gồm những bước nào?',
    answer:
      'Chọn sự kiện → chọn suất diễn → chọn khu và số lượng vé → đồng ý điều khoản → bấm “Giữ chỗ và thanh toán”. Chỗ được giữ trong ít phút; bạn quét mã QR thanh toán và chuyển khoản trong thời gian đó. Vé được phát ngay khi hệ thống nhận tiền.',
  },
  {
    question: 'Tôi xem vé và mã vào cửa ở đâu?',
    answer:
      'Mở mục “Vé của tôi”. Mỗi vé ghi tên sự kiện, suất diễn, địa điểm, khu và ghế. Mở vé để hiện mã QR và đưa cho nhân viên soát vé ở cửa.',
  },
  {
    question: 'Xem lại đơn hàng đã thanh toán ở đâu?',
    answer:
      'Vào Tài khoản → Đơn hàng của tôi. Lọc “Đã thanh toán” để xem các đơn đã trả tiền; đơn còn chờ thanh toán có thể mở lại để trả tiếp mà không tạo đơn mới.',
  },
  {
    question: 'Một lần được mua tối đa bao nhiêu vé?',
    answer:
      'Mỗi suất diễn có giới hạn số vé cho một tài khoản do ban tổ chức đặt. Màn chọn chỗ hiện “Bạn còn mua được … vé cho suất này” trước khi bạn giữ chỗ.',
  },
  {
    question: 'Sự kiện đã lưu được giữ ở đâu?',
    answer:
      'Danh sách sự kiện đã lưu nằm trên trình duyệt hoặc điện thoại bạn đang dùng — chưa đồng bộ giữa website và app. Xoá dữ liệu trình duyệt hoặc gỡ app sẽ xoá danh sách này.',
  },
];

export default function SupportPage() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Hỗ trợ</h1>
      <p className={styles.updated}>Hỏi trợ lý, hoặc gặp nhân viên hỗ trợ</p>

      {/*
        Khung chat đặt TRÊN phần FAQ. Người mở trang này thường đã đọc lướt qua câu hỏi thường gặp
        và không tìm thấy thứ mình cần — bắt họ cuộn qua chín mục nữa rồi mới tới chỗ hỏi được là
        đặt thứ tự ngược với việc họ đang làm.
      */}
      <SupportChat />

      <h2 className={styles.sectionTitle} style={{ marginTop: 'var(--nt-space-8)' }}>
        Câu hỏi thường gặp
      </h2>
      <div className={styles.faq}>
        {FAQ.map((item) => (
          <details key={item.question} className={styles.faqItem}>
            <summary className={styles.faqQuestion}>{item.question}</summary>
            <p className={styles.faqAnswer}>{item.answer}</p>
          </details>
        ))}
      </div>

      <section className={styles.section} style={{ marginTop: 'var(--nt-space-8)' }}>
        <h2 className={styles.sectionTitle}>Khi báo sự cố</h2>
        <p>
          Kèm theo <strong>mã tra cứu</strong> hiện trên màn hình lỗi hoặc màn hình đơn hàng — đó là
          thứ giúp tìm lại đúng yêu cầu của bạn trong nhật ký hệ thống. Dán nó thẳng vào khung chat
          phía trên cũng được.
        </p>
      </section>
    </main>
  );
}
