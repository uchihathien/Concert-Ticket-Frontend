import type { Order } from '@nexaticket/ts-sdk';
import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionIndex } from '@/lib/session-index';
import { PaymentPanel } from '../PaymentPanel';
import { renderWithApi } from './harness';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
}));

beforeEach(() => replace.mockReset());

const INDEX: SessionIndex = {
  s1: {
    slug: 'dem-nhac-ha',
    eventTitle: 'Đêm nhạc Hạ',
    startsAt: '2026-11-01T12:00:00Z',
    endsAt: null,
    venueName: 'Nhà hát Lớn',
    city: 'Hà Nội',
    posterUrl: null,
  },
};

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: 'o1',
    orderNumber: 'NT1000001',
    eventSessionId: 's1',
    eventId: 'e1',
    status: 'AWAITING_PAYMENT',
    subtotalVnd: 3_000_000,
    discountVnd: 0,
    totalVnd: 3_000_000,
    paymentReference: 'NT1000001',
    vietQrPayload: '00020101021238570010A000000727',
    checkoutUrl: 'https://pay.payos.test/web/abc',
    // Một giờ sau "bây giờ" — đồng hồ còn chạy.
    paymentExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    paidAt: null,
    items: [
      {
        seatCode: 'A-1',
        zoneCode: 'A',
        admissionType: 'SEATED',
        seatLabel: '1',
        ticketTypeName: 'Hạng A',
        unitPriceVnd: 1_500_000,
        discountVnd: 0,
      },
      {
        seatCode: null,
        zoneCode: 'SAN',
        admissionType: 'STANDING',
        seatLabel: null,
        ticketTypeName: 'Vé đứng',
        unitPriceVnd: 1_500_000,
        discountVnd: 0,
      },
    ],
    ...overrides,
  };
}

function mount(...responses: Order[]) {
  let n = 0;
  return renderWithApi(<PaymentPanel orderId="o1" sessionIndex={INDEX} />, (call) => {
    if (call.method === 'GET' && call.path === '/v1/orders/o1') {
      const body = responses[Math.min(n, responses.length - 1)];
      n += 1;
      return { status: 200, body };
    }
    throw new Error(`Không có route giả cho ${call.method} ${call.path}`);
  });
}

describe('PaymentPanel', () => {
  it('đơn chờ tiền: link payOS là thẻ <a> cùng tab, có QR, tóm tắt nói rõ sự kiện nào', async () => {
    mount(order());

    const link = await screen.findByRole('link', { name: 'Thanh toán qua payOS' });
    expect(link).toHaveAttribute('href', 'https://pay.payos.test/web/abc');
    expect(link).not.toHaveAttribute('target');
    expect(screen.getByRole('heading', { name: 'Đêm nhạc Hạ' })).toBeInTheDocument();
    expect(screen.getByText('Nhà hát Lớn · Hà Nội')).toBeInTheDocument();
    expect(screen.getByText('Hạng A · ghế 1')).toBeInTheDocument();
    expect(screen.getByText('Vé đứng · vé đứng')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveAttribute('data-state', 'normal');
    expect(screen.getByRole('heading', { name: 'Đơn NT1000001' })).toBeInTheDocument();
  });

  it('không có cả link payOS lẫn QR thì nói thẳng khách phải làm gì', async () => {
    mount(order({ checkoutUrl: null, vietQrPayload: null, paymentReference: null }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chưa tạo được liên kết thanh toán cho đơn này',
    );
  });

  it('đã trả tiền thì chuyển NGAY sang trang vé bằng replace', async () => {
    mount(order({ status: 'PAID', paidAt: '2026-11-01T11:00:00Z' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/orders/o1/tickets'));
    expect(screen.getByRole('link', { name: 'Xem vé ngay' })).toHaveAttribute(
      'href',
      '/orders/o1/tickets',
    );
  });

  it.each([
    ['EXPIRED', 'Đơn đã hết hạn thanh toán'],
    ['CANCELLED', 'Đơn đã bị huỷ'],
    ['REFUNDED', 'Đơn đã được hoàn tiền'],
  ] as const)('đơn %s: không còn QR hay link trả tiền', async (status, title) => {
    const { container } = mount(order({ status }));
    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Thanh toán qua payOS' })).toBeNull();
    expect(container.querySelector('svg[aria-label*="VietQR"], [aria-label*="VietQR"]')).toBeNull();
    expect(screen.getByRole('link', { name: 'Chọn sự kiện khác' })).toHaveAttribute('href', '/events');
  });

  it('tiền tới sau khi đơn hết hạn: nói rõ là ĐÃ nhận tiền và sẽ hoàn', async () => {
    mount(order({ status: 'MANUAL_REVIEW' }));
    expect(await screen.findByText('Tiền tới sau khi đơn hết hạn')).toBeInTheDocument();
    expect(screen.getByText(/đã nhận được khoản chuyển khoản của bạn/)).toBeInTheDocument();
  });

  it('đồng hồ chạy hết thì hỏi lại backend và chuyển sang trạng thái đã đóng', async () => {
    const past = new Date(Date.now() - 1_000).toISOString();
    const { calls } = mount(order({ paymentExpiresAt: past }), order({ status: 'EXPIRED' }));

    expect(await screen.findByText('Đơn đã hết hạn thanh toán')).toBeInTheDocument();
    expect(calls.filter((c) => c.path === '/v1/orders/o1').length).toBeGreaterThanOrEqual(2);
  });

  it('suất diễn không có trong bảng tra thì không bịa tên sự kiện, vẫn hiện mã đơn', async () => {
    mount(order({ eventSessionId: 'khong-co' }));
    expect(await screen.findByRole('heading', { name: 'Đơn NT1000001' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Đêm nhạc Hạ' })).toBeNull();
  });
});
