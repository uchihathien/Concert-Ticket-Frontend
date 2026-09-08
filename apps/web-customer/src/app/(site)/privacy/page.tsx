import type { Metadata } from 'next';
import styles from '../legal.module.css';

export const metadata: Metadata = {
  title: 'Chính sách bảo mật — NexaTicket',
  description: 'Cách NexaTicket thu thập và xử lý dữ liệu người dùng.',
};

/**
 * Bản nháp kỹ thuật, không phải văn bản pháp lý — xem ghi chú ở `terms/page.tsx`.
 *
 * Phần mô tả dữ liệu dưới đây bám theo những gì hệ thống **thực sự** lưu (tài khoản ở Keycloak,
 * đơn hàng, vé, nhật ký soát vé). Viết vống lên hay viết thiếu đều là vấn đề, nên chỗ nào chưa
 * chốt thì nói thẳng là chưa chốt.
 */
export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Chính sách bảo mật</h1>
      <p className={styles.updated}>Bản nháp · chưa có hiệu lực</p>

      <p className={styles.draft}>
        <strong>Đây là nội dung mẫu.</strong> Văn bản mô tả cách hệ thống đang xử lý dữ liệu ở mức
        kỹ thuật, chưa được bộ phận pháp chế soạn và duyệt.
      </p>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Dữ liệu nền tảng lưu</h2>
        <ul>
          <li>
            <strong>Tài khoản:</strong> email và thông tin đăng nhập do hệ thống định danh
            (Keycloak) quản lý. Nền tảng không lưu mật khẩu của bạn.
          </li>
          <li>
            <strong>Đơn hàng và vé:</strong> sự kiện, suất diễn, chỗ ngồi, số tiền, trạng thái thanh
            toán.
          </li>
          <li>
            <strong>Nhật ký soát vé:</strong> thời điểm và kết quả mỗi lần quét mã tại cửa, phục vụ
            đối soát và xử lý tranh chấp.
          </li>
          <li>
            <strong>Nhật ký kỹ thuật:</strong> mã tra cứu (correlation id) gắn với mỗi yêu cầu, để
            hỗ trợ tìm lại đúng sự việc khi bạn báo lỗi.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Ban tổ chức thấy gì</h2>
        <p>
          Ban tổ chức sự kiện chỉ thấy dữ liệu thuộc tổ chức của họ. Hệ thống kiểm tra quyền ở phía
          máy chủ cho từng yêu cầu, không dựa vào giao diện để giới hạn.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Phiên đăng nhập</h2>
        <p>
          Phiên đăng nhập nằm trong một cookie chỉ máy chủ đọc được. Khoá làm mới phiên không bao
          giờ được gửi xuống trình duyệt, và mã truy cập chỉ tồn tại trong bộ nhớ tạm của tab đang
          mở — đóng tab là mất.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Thời gian lưu và quyền của bạn</h2>
        <p>
          Thời hạn lưu từng loại dữ liệu, cách yêu cầu trích xuất hoặc xoá dữ liệu, và đầu mối tiếp
          nhận sẽ được bổ sung khi bản chính thức được duyệt.
        </p>
      </section>
    </main>
  );
}
