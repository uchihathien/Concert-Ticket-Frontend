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
