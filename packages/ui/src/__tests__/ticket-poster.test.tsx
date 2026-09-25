import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TicketPoster } from '../components/TicketPoster';

/**
 * Ảnh vé.
 *
 * Phần đáng kiểm nhất là **dải tranh ở đầu vé phải nằm TRONG chuỗi được tuần tự hoá**. Phần xuất
 * ảnh nạp chính thẻ `<svg>` vào một `<img>` qua `data:image/svg+xml`, và một SVG dùng làm nguồn ảnh
 * thì không tải được tài nguyên ngoài nào — nên một `href="https://…"` hiện đúng trên màn hình rồi
 * biến mất khỏi file PNG. Kiểu hỏng ấy chỉ lộ ra sau khi khách đã tải vé về.
 */

const TICKET = {
  eventTitle: 'Đêm nhạc Hạ',
  sessionAt: '14/06/2026 · 20:00',
  venueLine: 'Nhà hát Lớn, Hà Nội',
  zoneCode: 'A',
  seatLabel: '12',
  ticketTypeName: 'Hạng A',
  ticketCode: 'NT-ABC123',
  qrToken: 'eyJhbGciOiJFUzI1NiJ9.eyJqdGkiOiJ4In0.sig',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TicketPoster', () => {
  it('không có ảnh bìa thì vé vẫn ra, chỉ không có dải tranh', () => {
    const { container } = render(<TicketPoster {...TICKET} />);

    expect(container.querySelectorAll('image')).toHaveLength(0);
    // Sự kiện chưa có ảnh không được vì thế mà không xuất được vé.
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('đế trắng dưới mã QR luôn có — máy quét cần tương phản đúng chiều', () => {
    const { container } = render(<TicketPoster {...TICKET} />);

    const white = [...container.querySelectorAll('rect')].filter(
      (rect) => rect.getAttribute('fill') === '#ffffff',
    );
    expect(white.length).toBeGreaterThanOrEqual(1);
  });

  it('ảnh bìa được NHÚNG thành data URI, không để nguyên URL ngoài', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => new Blob(['giả-lập-ảnh'], { type: 'image/png' }),
      }),
    );

    const { container } = render(
      <TicketPoster {...TICKET} posterUrl="https://cdn.example.com/poster.png" />,
    );

    await waitFor(() => {
      const image = container.querySelector('image');
      expect(image).toBeTruthy();
      // Đây là toàn bộ điểm của bài test: `href` phải là data URI. Một URL https ở đây nghĩa là
      // dải tranh sẽ biến mất khỏi file PNG xuất ra.
      expect(image?.getAttribute('href')).toMatch(/^data:/);
    });
  });

  it('kho ảnh chặn CORS thì vé vẫn tải được, chỉ mất dải tranh', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const { container } = render(
      <TicketPoster {...TICKET} posterUrl="https://cdn.example.com/poster.png" />,
    );

    // Không ném, không khung lỗi: vé là thứ khách cần ở cửa vào, còn ảnh bìa là thứ tô điểm.
    await waitFor(() => expect(container.querySelector('svg')).toBeTruthy());
    expect(container.querySelectorAll('image')).toHaveLength(0);
  });

  it('ảnh trả về lỗi HTTP cũng không làm vé vỡ', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    const { container } = render(
      <TicketPoster {...TICKET} posterUrl="https://cdn.example.com/mat-roi.png" />,
    );

    await waitFor(() => expect(container.querySelector('svg')).toBeTruthy());
    expect(container.querySelectorAll('image')).toHaveLength(0);
  });
});
