/**
 * Ảnh bìa tạm cho sự kiện chưa có poster.
 *
 * Site bán vé sống bằng hình ảnh: một lưới toàn ô xám trông như trang hỏng, không phải như trang
 * đang chờ dữ liệu. Cho tới khi `catalog-service` trả poster thật, mỗi sự kiện nhận một dải màu
 * riêng — trông có chủ đích thay vì trống rỗng.
 *
 * Màu lấy từ họ màu của NexaTicket (đỏ ấm, vàng kim, xanh lá trạng thái, nền tối), không lấy của
 * bên nào khác.
 */

const COVERS = [
  'linear-gradient(135deg, #7d1414 0%, #c02a2a 55%, #f2b705 100%)',
  'linear-gradient(135deg, #2a1f00 0%, #b06a00 55%, #f2b705 100%)',
  'linear-gradient(135deg, #14100f 0%, #1f7a4d 70%)',
  'linear-gradient(135deg, #3a0f0f 0%, #a32222 60%, #d99a00 100%)',
  'linear-gradient(135deg, #10231b 0%, #1f7a4d 55%, #f2b705 120%)',
  'linear-gradient(135deg, #1d1817 0%, #6b625c 60%, #c02a2a 130%)',
];

/**
 * Cùng một `seed` luôn cho ra cùng một dải màu.
 *
 * Điều đó quan trọng hơn vẻ đẹp: thẻ ở trang chủ, thẻ ở trang danh sách và băng rôn ở trang chi
 * tiết phải cùng màu cho một sự kiện, nếu không người dùng sẽ không nhận ra mình vừa bấm vào cái
 * gì. Màu ngẫu nhiên mỗi lần render cũng làm ảnh nhảy màu giữa server và client.
 */
export function coverGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return COVERS[Math.abs(hash) % COVERS.length] ?? COVERS[0]!;
}
