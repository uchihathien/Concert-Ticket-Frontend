/**
 * Định nghĩa DUY NHẤT của từng chỉ số.
 *
 * Mọi trang lấy câu chú giải từ đây. Hai trang tự viết hai câu cho cùng một chỉ số là hai định
 * nghĩa sẽ lệch nhau, và ban tổ chức sẽ hỏi vì sao "doanh thu" ở hai chỗ khác số.
 */
export const METRIC_HELP = {
  revenue:
    'Tổng tiền của các đơn đã thanh toán, tính theo thời điểm đặt đơn trong kỳ. Chưa trừ phí của nền tảng.',
  ticketsSold: 'Số vé thuộc các đơn đã thanh toán, tính theo thời điểm đặt đơn trong kỳ.',
  orders: 'Số đơn được tạo trong kỳ, gồm cả đơn đang chờ, quá hạn và đã huỷ.',
  ordersPaid: 'Số đơn được tạo trong kỳ và đã thanh toán.',
  averageOrderValue: 'Doanh thu chia cho số đơn đã thanh toán.',
  ticketsPerOrder: 'Số vé đã bán chia cho số đơn đã thanh toán.',
  paymentRate: 'Số đơn đã thanh toán chia cho tổng số đơn được tạo trong kỳ.',
  occupancy:
    'Số chỗ đã bán chia cho tổng số chỗ đã mở bán, tính ở thời điểm hiện tại — không phụ thuộc khoảng thời gian đang chọn.',
  arrivalRate:
    'Số vé đã vào cửa ít nhất một lần chia cho số vé còn hiệu lực, tính ở thời điểm hiện tại — không phụ thuộc khoảng thời gian đang chọn.',
  held: 'Số chỗ đang nằm trong giỏ hoặc trong đơn chờ thanh toán, ở thời điểm hiện tại. Chúng tự nhả khi hết hạn.',
  daysToShow: 'Số ngày từ hôm nay tới suất diễn gần nhất chưa diễn ra, trong các sự kiện đang chọn.',
  timeToPay: 'Thời gian trung bình từ lúc tạo đơn tới lúc thanh toán thành công, chỉ tính đơn đã thanh toán.',
  abandonRate: 'Số đơn quá hạn hoặc bị huỷ chia cho tổng số đơn được tạo trong kỳ.',
  remaining: 'Số chỗ còn trống ở các suất chưa diễn, tại thời điểm hiện tại. Không tính chỗ đang giữ và chỗ bị khoá.',
  velocity: 'Số vé thuộc các đơn đã thanh toán trong 7 ngày gần nhất, chia cho 7. Không phụ thuộc khoảng thời gian đang chọn.',
  sellOut:
    'Số chỗ còn bán được chia cho tốc độ bán 7 ngày gần nhất. Là ước tính thô: giả định những ngày tới bán như tuần vừa qua.',
  inside: 'Số vé đang ở trạng thái "ở trong" tại thời điểm hiện tại: đã quét vào và chưa quét ra.',
  entries: 'Số lượt quét vào được chấp nhận trong kỳ, gồm cả vào lại. Tính theo thời điểm quét.',
  reentries: 'Số lượt vào trừ đi số vé khác nhau đã vào trong kỳ — tức là những lượt vào từ lần thứ hai trở đi.',
  rejected: 'Số lượt quét không được chấp nhận trong kỳ (vé đã dùng, sai suất, mã không hợp lệ, chưa tới giờ…), cả chiều vào lẫn chiều ra.',
  overrides: 'Số lượt nhân viên cho vào thủ công (không qua quét mã hay nhập mã vé) trong kỳ. Mỗi lượt đều có lý do đi kèm.',
  noShow: 'Số vé còn hiệu lực chưa từng vào cửa, chỉ tính các suất đã kết thúc. Suất chưa diễn không được tính là vắng mặt.',
  buyers: 'Số người khác nhau có ít nhất một đơn đã thanh toán trong kỳ.',
  newBuyers: 'Người mua trong kỳ mà trước kỳ chưa từng có đơn đã thanh toán nào ở tổ chức này.',
  returningBuyers: 'Người mua trong kỳ đã từng có đơn đã thanh toán ở tổ chức này trước kỳ.',
  repeatBuyers: 'Người mua có từ hai đơn đã thanh toán trở lên ngay trong kỳ.',
  ordersPerBuyer: 'Số đơn đã thanh toán chia cho số người mua trong kỳ.',
  noShowValue: 'Số vé vắng mặt nhân với giá niêm yết của loại vé tương ứng. Đây là tiền vé đã thu của những chỗ không có người đến, không phải doanh thu bị mất.',
} as const;
