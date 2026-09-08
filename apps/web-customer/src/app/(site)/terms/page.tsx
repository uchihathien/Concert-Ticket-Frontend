import type { Metadata } from 'next';
import styles from '../legal.module.css';

export const metadata: Metadata = {
  title: 'Điều khoản sử dụng — NexaTicket',
  description: 'Điều khoản sử dụng nền tảng bán vé NexaTicket.',
};

/**
 * Nội dung là **bản nháp kỹ thuật**, không phải văn bản pháp lý.
 *
 * Tôi dựng khung và câu chữ trung tính để trang không còn 404 và để bộ phận pháp chế có chỗ dán
 * nội dung thật vào. Điều khoản bán vé ràng buộc quyền lợi tiền bạc của khách và của ban tổ
 * chức — không ai nên tự nghĩ ra rồi phát hành, nên cảnh báo ở đầu trang phải giữ nguyên cho tới
 * khi có bản duyệt.
 */
export default function TermsPage() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Điều khoản sử dụng</h1>
      <p className={styles.updated}>Bản nháp · chưa có hiệu lực</p>

      <p className={styles.draft}>
        <strong>Đây là nội dung mẫu.</strong> Văn bản dưới đây chỉ mô tả cách nền tảng vận hành về
        mặt kỹ thuật, chưa được bộ phận pháp chế soạn và duyệt, và không có giá trị ràng buộc.
      </p>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>1. NexaTicket là ai trong giao dịch</h2>
        <p>
          NexaTicket là nền tảng trung gian. Sự kiện do ban tổ chức tạo và chịu trách nhiệm về nội
          dung, thời gian, địa điểm và việc thực hiện chương trình. Nền tảng nhận tiền vé và giữ hộ
          cho tới khi tới hạn đối soát với ban tổ chức.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>2. Giữ chỗ và thanh toán</h2>
        <ul>
          <li>
            Chọn chỗ xong, hệ thống giữ chỗ trong một khoảng thời gian có đếm ngược hiển thị trên
            màn hình. Hết thời gian, chỗ được trả lại cho người khác mua.
          </li>
          <li>
            Đơn hàng chỉ được coi là thành công khi khoản thanh toán đã được xác nhận. Trước thời
            điểm đó, chỗ chưa thuộc về ai.
          </li>
          <li>
            Vé được phát hành sau khi thanh toán xác nhận. Có thể có độ trễ vài giây giữa lúc nhận
            tiền và lúc vé xuất hiện trong mục &ldquo;Vé của tôi&rdquo;.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>3. Vé và soát vé</h2>
        <p>
          Mỗi vé mang một mã QR có chữ ký và có hạn. Mã chỉ dùng được một lần tại cửa soát vé của
          đúng suất diễn ghi trên vé. Ảnh chụp màn hình một mã đã dùng sẽ bị từ chối.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>4. Huỷ, đổi, hoàn tiền</h2>
        <p>
          Chính sách huỷ và hoàn tiền do ban tổ chức từng sự kiện quyết định và được công bố trên
          trang của sự kiện đó. Phần nội dung này sẽ được hoàn thiện cùng bộ phận pháp chế.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>5. Liên hệ</h2>
        <p>
          Vướng mắc về đơn hàng hoặc vé, xem trang <a href="/support">Hỗ trợ</a>.
        </p>
      </section>
    </main>
  );
}
