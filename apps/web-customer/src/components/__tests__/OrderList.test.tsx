import type { Order, OrderStatus } from '@nexaticket/ts-sdk';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { SessionIndex } from '@/lib/session-index';
import { OrderList } from '../OrderList';
import { renderWithApi, type FakeCall } from './harness';

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

function order(id: string, status: OrderStatus, extra: Partial<Order> = {}): Order {
  return {
    id,
    orderNumber: `NT-${id}`,
    eventSessionId: 's1',
    eventId: 'e1',
    status,
    subtotalVnd: 1_000_000,
    discountVnd: 0,
    totalVnd: 1_000_000,
    paymentReference: status === 'AWAITING_PAYMENT' ? `NT-${id}` : null,
    vietQrPayload: null,
    checkoutUrl: status === 'AWAITING_PAYMENT' ? `https://pay.payos.test/${id}` : null,
    paymentExpiresAt: null,
    paidAt: status === 'PAID' ? '2026-10-20T03:00:00Z' : null,
    items: [
      {
        seatCode: null,
        zoneCode: 'SAN',
        admissionType: 'STANDING',
        seatLabel: null,
        ticketTypeName: 'Vé đứng',
        unitPriceVnd: 500_000,
        discountVnd: 0,
      },
      {
        seatCode: null,
        zoneCode: 'SAN',
        admissionType: 'STANDING',
        seatLabel: null,
        ticketTypeName: 'Vé đứng',
        unitPriceVnd: 500_000,
        discountVnd: 0,
      },
    ],
    ...extra,
  };
}

const ALL: Order[] = [
  order('o1', 'AWAITING_PAYMENT'),
  order('o2', 'PAID'),
  order('o3', 'EXPIRED'),
  order('o4', 'CANCELLED'),
  order('o5', 'REFUNDED'),
  order('o6', 'MANUAL_REVIEW'),
];

function mount(orders: Order[], extra: (call: FakeCall) => { status: number; body?: unknown } | null = () => null) {
  return renderWithApi(<OrderList sessionIndex={INDEX} />, (call) => {
    const custom = extra(call);
    if (custom) return custom;
    if (call.path === '/v1/me/orders?limit=50&offset=0') return { status: 200, body: orders };
    if (call.path === '/v1/me/tickets?limit=100&offset=0') {
      // Chỉ đơn đã thanh toán mới có vé — cầu nối orderId → suất diễn đi qua đây.
      return { status: 200, body: [{ id: 't1', orderId: 'o2', eventSessionId: 's1' }] };
    }
    throw new Error(`Không có route giả cho ${call.method} ${call.path}`);
  });
}

const cards = () => screen.getAllByRole('heading', { level: 2 });

describe('OrderList', () => {
  it('mỗi trạng thái có nhãn tiếng Việt riêng', async () => {
    mount(ALL);
    await screen.findByText('Chờ thanh toán', { selector: 'span' });
    for (const label of [
      'Đã thanh toán',
      'Quá hạn chuyển khoản',
      'Bạn đã huỷ',
      'Đã hoàn tiền',
      'Đang đối soát',
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('bộ lọc gộp sáu trạng thái thành ba việc, có số đếm trước khi bấm', async () => {
    const user = userEvent.setup();
    mount(ALL);
    const filters = await screen.findByRole('group', { name: 'Lọc đơn hàng' });
    const button = (name: RegExp) => within(filters).getByRole('button', { name });

    expect(button(/^Tất cả/)).toHaveTextContent('6');
    expect(button(/^Chờ thanh toán/)).toHaveTextContent('1');
    // MANUAL_REVIEW: tiền đã tới, nên thuộc nhóm "đã thanh toán", không phải "đã đóng".
    expect(button(/^Đã thanh toán/)).toHaveTextContent('2');
    expect(button(/^Đã đóng/)).toHaveTextContent('3');

    await user.click(button(/^Đã thanh toán/));
    expect(button(/^Đã thanh toán/)).toHaveAttribute('aria-pressed', 'true');
    expect(cards()).toHaveLength(2);
  });

  it('đơn đã thanh toán lấy được tên sự kiện qua ví vé; đơn chưa có vé thì hiện mã đơn', async () => {
    mount(ALL);
    expect(await screen.findByRole('link', { name: 'Đêm nhạc Hạ' })).toHaveAttribute(
      'href',
      '/events/dem-nhac-ha',
    );
    expect(screen.getByRole('heading', { name: 'Đơn NT-o1' })).toBeInTheDocument();
  });

  it('gộp các dòng cùng hạng vé: hai vé đứng thành một dòng ×2', async () => {
    mount([order('o3', 'EXPIRED')]);
    expect(await screen.findByText('×2')).toBeInTheDocument();
  });

  it('chỉ đơn chờ thanh toán có nút payOS và nút huỷ', async () => {
    mount(ALL);
    await screen.findByRole('group', { name: 'Lọc đơn hàng' });
    expect(screen.getAllByRole('link', { name: 'Thanh toán qua payOS' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Huỷ đơn' })).toHaveLength(1);
  });

  it('huỷ đơn: POST /cancel, báo thành công, làm mới danh sách', async () => {
    const user = userEvent.setup();
    const { calls } = mount([order('o1', 'AWAITING_PAYMENT')], (call) =>
      call.method === 'POST' && call.path === '/v1/orders/o1/cancel' ? { status: 204 } : null,
    );
    await user.click(await screen.findByRole('button', { name: 'Huỷ đơn' }));

    expect(await screen.findByText('Đã huỷ đơn')).toBeInTheDocument();
    await waitFor(() =>
      expect(calls.filter((c) => c.path.startsWith('/v1/me/orders')).length).toBeGreaterThanOrEqual(2),
    );
  });

  it('huỷ đơn bị từ chối thì hiện lỗi dạng alert, không báo thành công', async () => {
    const user = userEvent.setup();
    mount([order('o1', 'AWAITING_PAYMENT')], (call) =>
      call.method === 'POST' && call.path === '/v1/orders/o1/cancel'
        ? { status: 409, body: { code: 'ORDER_NOT_CANCELLABLE', detail: 'already paid' } }
        : null,
    );
    await user.click(await screen.findByRole('button', { name: 'Huỷ đơn' }));

    const alert = await screen.findByRole('alert');
    expect(alert).not.toHaveTextContent('already paid');
    expect(screen.queryByText('Đã huỷ đơn')).toBeNull();
  });

  it('chưa có đơn nào thì mời đi xem sự kiện', async () => {
    mount([]);
    expect(await screen.findByText('Chưa có đơn hàng nào')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem sự kiện đang bán' })).toHaveAttribute(
      'href',
      '/events',
    );
  });

  it('API lỗi thì hiện khối lỗi thay vì danh sách trống', async () => {
    renderWithApi(<OrderList sessionIndex={INDEX} />, (call) =>
      call.path.startsWith('/v1/me/orders')
        ? { status: 503, body: { code: 'INTERNAL_ERROR' } }
        : { status: 200, body: [] },
    );
    await waitFor(() => expect(screen.queryByText('Chưa có đơn hàng nào')).toBeNull());
    expect(await screen.findByRole('button', { name: /Thử lại/ })).toBeInTheDocument();
  });
});
