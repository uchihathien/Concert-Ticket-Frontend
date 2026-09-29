import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PosterImage } from '../components/PosterImage';

/**
 * Ảnh bìa từ database.
 *
 * Mọi nơi dùng đều đặt ảnh chồng lên một dải màu nền. Component này tồn tại để dải màu ấy vẫn là
 * phương án dự phòng **khi URL có mà ảnh không tải được** — nếu không, trình duyệt vẽ biểu tượng
 * ảnh vỡ đè lên và cả lưới thẻ thành một dãy ô hỏng.
 */
describe('PosterImage', () => {
  it('không dựng gì khi chưa có ảnh', () => {
    const { container } = render(<PosterImage src={null} alt="Áp phích" />);

    // Trả về một khung trống hay một ảnh rỗng đều che mất dải màu bên dưới.
    expect(container.querySelector('img')).toBeNull();
  });

  it('chuỗi rỗng cũng là chưa có ảnh', () => {
    // Backend dùng chuỗi rỗng cho "xoá ảnh bìa" (xem PosterUrlPolicy), nên nó tới được đây.
    const { container } = render(<PosterImage src="" alt="Áp phích" />);

    expect(container.querySelector('img')).toBeNull();
  });

  it('ảnh hỏng thì tự gỡ mình đi, nhường chỗ cho dải màu', () => {
    const { container } = render(<PosterImage src="https://cdn.example/mat-roi.svg" alt="Áp phích" />);

    const image = container.querySelector('img');
    expect(image).not.toBeNull();

    // Kho vật thể chưa chạy ở máy phát triển, hoặc vật thể đã bị xoá — cả hai đều tới đây.
    fireEvent.error(image!);

    expect(container.querySelector('img')).toBeNull();
  });

  it('chỉ hiện ra sau khi tải xong', () => {
    const { container } = render(<PosterImage src="https://cdn.example/poster.svg" alt="Áp phích" />);
    const image = container.querySelector('img')!;

    // Lớp `ready` là thứ đưa opacity từ 0 lên 1. Thiếu bước này thì poster "nhảy" đè lên dải màu,
    // và trên một lưới nhiều thẻ thì cả lưới nhấp nháy dần.
    const before = image.className;
    fireEvent.load(image);

    expect(image.className).not.toBe(before);
  });

  it('ảnh trang trí bị ẩn khỏi trình đọc màn hình', () => {
    // Nền hero là chính tấm poster đã thổi to và làm mờ. Tên sự kiện nằm ngay cạnh dưới dạng chữ,
    // nên đọc lại nó lần nữa là tiếng ồn.
    render(<PosterImage src="https://cdn.example/poster.svg" alt="Áp phích Đêm nhạc" decorative />);

    expect(screen.queryByAltText('Áp phích Đêm nhạc')).toBeNull();
  });

  it('ảnh nội dung giữ nguyên mô tả', () => {
    render(<PosterImage src="https://cdn.example/poster.svg" alt="Áp phích Đêm nhạc" />);

    expect(screen.getByAltText('Áp phích Đêm nhạc')).toBeInTheDocument();
  });
});
