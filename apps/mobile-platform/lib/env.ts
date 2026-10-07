/**
 * Đọc một biến `EXPO_PUBLIC_*` sao cho RỖNG được xử lý như THIẾU, và bản production không bao giờ
 * im lặng rơi về một địa chỉ của máy phát triển.
 *
 * ## Vì sao không dùng `??`
 *
 * `process.env.X ?? 'http://localhost:8080'` chỉ bắt `undefined` và `null`. Khi biến CÓ mặt nhưng
 * RỖNG — EAS secret đặt thành chuỗi trắng, một dòng `X=` trong `.env`, hay một biến truyền vào mà
 * chưa kịp điền — `??` không bắt được, giá trị rỗng đi tiếp và app gọi API vào hư không. Đây đúng là
 * lớp lỗi đã hạ production hai lần ở dự án này: `baseUrl: ""` ở web, và `EMBEDDING_PROVIDER=""` làm
 * ai-chatbox-service không dựng nổi context. Cùng một nguyên nhân, hai tầng khác nhau.
 *
 * ## Vì sao bản production NÉM LỖI thay vì rơi về localhost
 *
 * Trên điện thoại, `http://localhost:8080` trỏ vào chính cái điện thoại đó — nơi không có service
 * nào. Rơi về đấy biến một lỗi cấu hình lúc BUILD (đọc được trong một dòng log) thành một lỗi mạng
 * lúc CHẠY, ở trên tay người dùng, với thông báo "Network request failed" chẳng nói gì về nguyên nhân.
 * Trong lúc demo thì đó là khoảng lặng không giải thích được. Ném lỗi kèm tên biến thì chỉ ra ngay
 * chỗ phải sửa.
 *
 * `__DEV__` là hằng số do Metro thay lúc đóng gói, nên nhánh ném lỗi bị loại hẳn khỏi bundle dev —
 * máy phát triển vẫn chạy được mà không cần khai biến nào.
 *
 * ## Giá trị phải được ĐỌC Ở CHỖ GỌI
 *
 * Metro thay thế đúng cụm `process.env.EXPO_PUBLIC_FOO` theo mặt chữ lúc đóng gói; nó không hiểu
 * `process.env[name]`. Vì vậy hàm này nhận GIÁ TRỊ đã đọc, không nhận tên biến để tự đọc.
 */
export function publicEnv(value: string | undefined, opts: { name: string; devFallback: string }): string {
  const trimmed = value?.trim();
  if (trimmed) return trimmed;

  if (__DEV__) return opts.devFallback;

  throw new Error(
    `Thiếu biến môi trường ${opts.name}. Bản build này không có giá trị nào cho nó, ` +
      `và bản production không dùng mặc định của máy phát triển (${opts.devFallback}). ` +
      `Khai nó trong eas.json (profile đang build) hoặc truyền vào tiến trình build, rồi build lại.`,
  );
}
