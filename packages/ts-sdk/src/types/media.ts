/**
 * Tải ảnh bìa sự kiện.
 *
 * Nguồn: `OrganizationMediaController` của catalog-service.
 *
 * ## Ba bước, không phải một
 *
 * Endpoint **không nhận file**. Nó trả về một URL đã ký để trình duyệt `PUT` thẳng lên kho vật thể
 * — byte ảnh không đi qua backend, cũng không qua gateway.
 *
 * 1. `POST …/uploads/poster` → nhận `uploadUrl` và `publicUrl`.
 * 2. `PUT uploadUrl` kèm **đúng** header `Content-Type` đã khai ở bước 1. Gửi kiểu khác thì kho
 *    vật thể từ chối, vì kiểu ấy nằm trong chữ ký.
 * 3. Lưu `publicUrl` vào sự kiện. Đây mới là lúc ảnh được kiểm kích thước và kiểu thật.
 *
 * Bước 3 là thứ khiến việc xin URL rồi bỏ đó không gây hại: chừng nào chưa có sự kiện nào trỏ
 * tới, vật thể đó chỉ là một file mồ côi.
 */

export interface PosterUploadTicket {
  /** `PUT` thẳng vào đây từ trình duyệt. Không gắn header `Authorization`. */
  uploadUrl: string;
  /** Địa chỉ để lưu vào sự kiện **sau khi** tải xong. */
  publicUrl: string;
  /** Phải gửi đúng chuỗi này ở header `Content-Type`. */
  contentType: string;
  /** Trần kích thước, để giao diện từ chối sớm thay vì bắt khách chờ tải xong rồi mới báo lỗi. */
  maxBytes: number;
  /** ISO-8601. URL này cho phép GHI vào kho, nên hạn của nó ngắn. */
  expiresAt: string;
}
