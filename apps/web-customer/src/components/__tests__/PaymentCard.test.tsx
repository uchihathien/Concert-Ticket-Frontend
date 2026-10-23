import type { Order, PaymentCard as PaymentCardData } from '@nexaticket/ts-sdk';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentCard } from '../PaymentCard';
import { renderWithApi } from './harness';

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: 'o1',
    orderNumber: 'NT-260925-FSQM90',
    eventSessionId: 's1',
    eventId: 'e1',
    status: 'AWAITING_PAYMENT',
    subtotalVnd: 3_600_000,
    discountVnd: 0,
    totalVnd: 3_600_000,
    paymentReference: 'NT260925FSQM90',
    vietQrPayload: '00020101021238570010A000000727',
    checkoutUrl: 'https://pay.payos.test/web/abc',
    paymentExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    paidAt: null,
    items: [],
    ...overrides,
  };
}

function card(overrides: Partial<PaymentCardData> = {}): PaymentCardData {
  return {
    kind: 'PAYMENT',
    orderId: 'o1',
    orderNumber: 'NT-260925-FSQM90',
    totalVnd: 3_600_000,
    vietQrPayload: '00020101021238570010A000000727',
    paymentReference: 'NT260925FSQM90',
    checkoutUrl: 'https://pay.payos.test/web/abc',
    paymentExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    ...overrides,
  };
}

/** Mỗi lần GET đơn trả phần tử kế tiếp; hết danh sách thì lặp phần tử cuối. */
function mount(
  cardData: PaymentCardData,
  responses: Order[],
  onSettled?: (s: Order['status']) => void,
  onRebook?: (text: string) => void,
) {
  let n = 0;
  return renderWithApi(<PaymentCard card={cardData} onSettled={onSettled} onRebook={onRebook} />, (call) => {
    if (call.method === 'GET' && call.path === '/v1/orders/o1') {
      const body = responses[Math.min(n, responses.length - 1)];
      n += 1;
      return { status: 200, body };
    }
    if (call.method === 'POST' && call.path === '/v1/orders/o1/cancel') {
      return { status: 204 };
    }
    throw new Error(`Không có route giả cho ${call.method} ${call.path}`);
  });
}

const withEvent: Partial<PaymentCardData> = {
  eventTitle: 'Đêm nhạc Trịnh',
  eventSlug: 'dem-nhac-trinh',
  sessionStartsAt: '2026-11-20T13:00:00Z',
  venueName: 'Nhà hát Lớn',
  lines: [{ zoneName: 'VIP', quantity: 2, unitPriceVnd: 1_800_000 }],
};

const qrIn = (container: HTMLElement) => container.querySelector('[aria-label*="VietQR"]');

describe('PaymentCard', () => {
  it('đơn chờ tiền: có QR, nội dung chuyển khoản, số đơn và link payOS cùng tab', async () => {
    const { container } = mount(card(), [order()]);

    const link = await screen.findByRole('link', { name: 'Thanh toán qua payOS' });
    expect(link.getAttribute('href')).toBe('https://pay.payos.test/web/abc');
    expect(link.getAttribute('target')).toBeNull();
    expect(qrIn(container)).not.toBeNull();
    expect(screen.getByText('NT260925FSQM90')).toBeInTheDocument();
    expect(screen.getByText(/NT-260925-FSQM90/)).toBeInTheDocument();
  });

  it('thẻ không mang VietQR nhưng đơn có thì vẫn vẽ QR từ đơn', async () => {
    const { container } = mount(card({ vietQrPayload: null, paymentReference: null }), [order()]);

    await screen.findByRole('link', { name: 'Thanh toán qua payOS' });
    expect(qrIn(container)).not.toBeNull();
    expect(screen.getByText('NT260925FSQM90')).toBeInTheDocument();
  });

  it('không có link payOS thì QR là đường chính, không có nút payOS', async () => {
    const { container } = mount(card({ checkoutUrl: null }), [order({ checkoutUrl: null })]);

    expect(await screen.findByText('Chuyển khoản VietQR')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Thanh toán qua payOS' })).toBeNull();
    expect(qrIn(container)).not.toBeNull();
  });

  it('đơn đã hết hạn: không QR, không link, nói chỗ đã được mở lại', async () => {
    const { container } = mount(card(), [order({ status: 'EXPIRED' })]);

    expect(await screen.findByText('Đơn đã hết hạn thanh toán')).toBeInTheDocument();
    expect(screen.getByText(/chỗ đã được mở lại/i)).toBeInTheDocument();
    expect(qrIn(container)).toBeNull();
    expect(screen.queryByRole('link', { name: 'Thanh toán qua payOS' })).toBeNull();
  });

  describe('hỏi lại mỗi 5 giây', () => {
    beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
    afterEach(() => vi.useRealTimers());

    it('đổi sang "đã thanh toán" ở lần hỏi thứ hai và báo onSettled đúng một lần', async () => {
      const onSettled = vi.fn();
      const { calls } = mount(card(), [order(), order({ status: 'PAID' })], onSettled);

      await screen.findByRole('link', { name: 'Thanh toán qua payOS' });
      expect(calls.filter((c) => c.path === '/v1/orders/o1')).toHaveLength(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
      });

      expect(await screen.findByText('Đã thanh toán — vé đã có trong Vé của tôi')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Xem vé ngay' }).getAttribute('href')).toBe(
        '/orders/o1/tickets',
      );
      expect(onSettled).toHaveBeenCalledTimes(1);
      expect(onSettled).toHaveBeenCalledWith('PAID');

      // Đã xong thì thôi hỏi: thêm 10 giây nữa không có lời gọi mới.
      const seen = calls.filter((c) => c.path === '/v1/orders/o1').length;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      expect(calls.filter((c) => c.path === '/v1/orders/o1')).toHaveLength(seen);
      expect(onSettled).toHaveBeenCalledTimes(1);
    });
  });

  it('thẻ có sự kiện thì hiện tên, địa điểm và dòng vé', async () => {
    mount(card(withEvent), [order()]);

    expect(await screen.findByText('Đêm nhạc Trịnh')).toBeInTheDocument();
    expect(screen.getByText(/Nhà hát Lớn/)).toBeInTheDocument();
    expect(screen.getByText('2 × VIP')).toBeInTheDocument();
  });

  it('Huỷ giữ chỗ gọi huỷ đơn rồi hỏi lại đơn', async () => {
    const { calls } = mount(card(), [order(), order({ status: 'CANCELLED' })]);

    fireEvent.click(await screen.findByRole('button', { name: 'Huỷ giữ chỗ' }));

    await waitFor(() =>
      expect(calls.some((c) => c.method === 'POST' && c.path === '/v1/orders/o1/cancel')).toBe(true),
    );
    await waitFor(() => expect(calls.filter((c) => c.path === '/v1/orders/o1').length).toBeGreaterThanOrEqual(2));
  });

  it('đơn hết hạn có nút Đặt lại gửi câu đặt lại đúng sự kiện', async () => {
    const onRebook = vi.fn();
    mount(card(withEvent), [order({ status: 'EXPIRED' })], undefined, onRebook);

    fireEvent.click(await screen.findByRole('button', { name: 'Đặt lại' }));

    expect(onRebook).toHaveBeenCalledWith('Đặt lại vé Đêm nhạc Trịnh');
  });
});
