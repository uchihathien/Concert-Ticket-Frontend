import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EventCard } from '../components/EventCard';
import { EventCardSkeleton } from '../components/EventCardSkeleton';

/**
 * Khối chờ của thẻ sự kiện.
 *
 * Bài kiểm ở đây không phải "có dựng ra gì không" mà là **hai thứ có cùng hình dạng không**. Một
 * skeleton lệch kích thước còn tệ hơn không có: nó hứa một bố cục rồi đổi ý ngay khi dữ liệu về,
 * và cả lưới nhảy một nhịp.
 */
describe('EventCardSkeleton', () => {
  it('dùng đúng bộ lớp CSS của thẻ thật', () => {
    // Chung `catalog.module.css` là thứ giữ cho hai bên không lệch. Nếu có người tách skeleton
    // sang một file CSS riêng, bài kiểm này đỏ — và đó là lúc cần đỏ.
    const real = render(
      <EventCard
        href="/events/dem-nhac"
        title="Đêm nhạc"
        dateLabel="12/10"
        venueLabel="Hà Nội"
        fromPriceVnd={500000}
      />,
    );
    const skeleton = render(<EventCardSkeleton />);

    // CSS Modules băm tên lớp, nên so tên đọc ra từ DOM chứ không viết cứng chuỗi.
    const realMedia = real.container.querySelector('article > div')!;
    const skeletonMedia = skeleton.container.querySelector('article > div')!;

    expect(skeletonMedia.className).toBe(realMedia.className);
  });

  it('chừa đúng ba dòng chữ như thẻ thật', () => {
    // Tiêu đề, dòng ngày · địa điểm, dòng giá. Thiếu một dòng thì chiều cao hụt và lưới nhảy đúng
    // lúc dữ liệu về.
    const { container } = render(<EventCardSkeleton />);

    expect(container.querySelector('h3')).not.toBeNull();
    expect(container.querySelectorAll('p')).toHaveLength(2);
  });

  it('không có liên kết — chưa có gì để bấm vào', () => {
    // Thẻ thật là một <a>. Skeleton mà cũng là liên kết thì bấm vào lúc đang chờ sẽ điều hướng tới
    // một href rỗng, và khách mất chỗ mình đang đứng.
    const { container } = render(<EventCardSkeleton />);

    expect(container.querySelector('a')).toBeNull();
  });

  it('các khối xám bị ẩn khỏi trình đọc màn hình', () => {
    // Trình đọc màn hình không cần nghe mô tả hình chữ nhật xám; `aria-busy` nằm ở vùng chứa dữ
    // liệu (xem loading.tsx của trang danh sách), không nằm ở từng ô.
    const { container } = render(<EventCardSkeleton />);

    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
  });
});
