import type { SeatMap } from '@nexaticket/ts-sdk';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SeatPicker } from '../SeatPicker';
import { renderWithApi, type FakeCall, type FakeRoute } from './harness';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
}));

beforeEach(() => replace.mockReset());

function seat(code: string, zone: string, status: SeatMap['seats'][number]['status'], price: number) {
  return {
    id: `id-${code}`,
    seatCode: code,
    zoneCode: zone,
    sectionLabel: `Khu ${zone}`,
    rowLabel: '1',
    seatLabel: code,
    posX: null,
    posY: null,
    ticketTypeId: `tt-${zone}`,
    ticketTypeName: `Hạng ${zone}`,
    priceVnd: price,
    status,
  };
}

/** Khu A: 2 ghế trống / 3 ghế. Khu B: 1 ghế trống. Khu đứng SAN: 5 chỗ. Còn mua được 3 vé. */
const SEAT_MAP: SeatMap = {
  eventSessionId: 's1',
  availabilityVersion: 1,
  seats: [
    seat('A-1', 'A', 'AVAILABLE', 1_500_000),
    seat('A-2', 'A', 'AVAILABLE', 1_500_000),
    seat('A-3', 'A', 'SOLD', 1_500_000),
    seat('B-1', 'B', 'AVAILABLE', 800_000),
    seat('B-2', 'B', 'HELD', 800_000),
  ],
  standingZones: [
    {
      zoneCode: 'SAN',
      ticketTypeId: 'tt-san',
      ticketTypeName: 'Vé đứng',
      priceVnd: 300_000,
      available: 5,
      capacity: 100,
    },
  ],
  purchaseAllowance: { limit: 4, used: 1, remaining: 3 },
};

function routes(overrides: Partial<Record<string, FakeRoute>> = {}): FakeRoute {
  return (call: FakeCall) => {
    const key = `${call.method} ${call.path}`;
    const override = overrides[key];
    if (override) return override(call);
    if (key === 'GET /v1/sessions/s1/seats') return { status: 200, body: SEAT_MAP };
    // Mặt bằng hỏng không được chặn việc mua vé.
    if (key === 'GET /v1/events/show/floor-plan') return { status: 404, body: { code: 'NOT_FOUND' } };
    if (key === 'POST /v1/sessions/s1/holds') {
      return {
        status: 201,
        body: { holdId: 'h1', expiresAt: '2026-11-01T12:10:00Z', seatIds: [], availabilityVersion: 2 },
      };
    }
    if (key === 'POST /v1/orders') {
      return {
        status: 201,
        body: {
          orderId: 'o1',
          orderNumber: 'NT1',
          totalVnd: 0,
          paymentReference: 'NT1',
          vietQrPayload: 'x',
          checkoutUrl: null,
          paymentExpiresAt: '2026-11-01T12:15:00Z',
        },
      };
    }
    throw new Error(`Không có route giả cho ${key}`);
  };
}

function mount(route = routes()) {
  return renderWithApi(
    <SeatPicker eventSessionId="s1" eventSlug="show" eventTitle="Đêm nhạc Hạ" />,
    route,
  );
}

const zone = (name: string) => screen.getByRole('heading', { name, level: 3 }).closest('section')!;
const plus = (name: string) => screen.getByRole('button', { name: `Thêm một vé ${name}` });
const submitButton = () => screen.getByRole('button', { name: /Giữ chỗ và thanh toán/ });

describe('SeatPicker', () => {
  it('liệt kê khu đắt trước, đếm chỉ ghế AVAILABLE, khu đứng ghi rõ không đánh số', async () => {
    mount();
    await screen.findByRole('heading', { name: 'Khu A', level: 3 });

    const names = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(names).toEqual(['Khu A', 'Khu B', 'Vé đứng']);
    expect(within(zone('Khu A')).getByText('Còn 2 ghế')).toBeInTheDocument();
    expect(within(zone('Khu B')).getByText('Còn 1 ghế')).toBeInTheDocument();
    expect(within(zone('Vé đứng')).getByText(/Còn 5 chỗ · khu đứng, không đánh số/)).toBeInTheDocument();
    expect(screen.getByText(/Bạn còn mua được 3 vé cho suất này \(đã mua 1\)/)).toBeInTheDocument();
  });

  it('nút "+" khoá khi đã chọn hết số chỗ còn trống của khu', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByRole('heading', { name: 'Khu B', level: 3 });

    await user.click(plus('Khu B'));
    expect(plus('Khu B')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Bớt một vé Khu B' })).toBeEnabled();
  });

  it('vượt trần mua thì báo lỗi và khoá nút đặt, kể cả khi đã đồng ý điều khoản', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByRole('heading', { name: 'Vé đứng', level: 3 });

    await user.click(screen.getByRole('checkbox'));
    for (let i = 0; i < 4; i++) await user.click(plus('Vé đứng'));

    expect(screen.getByRole('alert')).toHaveTextContent('Vượt quá số vé được mua cho suất này.');
    expect(submitButton()).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Bớt một vé Vé đứng' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(submitButton()).toBeEnabled();
  });

  it('chưa tick đồng ý điều khoản thì không đặt được — ô không tick sẵn', async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByRole('heading', { name: 'Khu A', level: 3 });
    await user.click(plus('Khu A'));

    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(submitButton()).toBeDisabled();
  });

  it('giữ chỗ theo khu rồi đặt đơn với HAI khoá chống trùng khác nhau, rồi sang trang thanh toán', async () => {
    const user = userEvent.setup();
    const { calls } = mount();
    await screen.findByRole('heading', { name: 'Khu A', level: 3 });

    await user.click(plus('Khu A'));
    await user.click(plus('Khu A'));
    await user.click(plus('Vé đứng'));
    expect(screen.getByText('3 vé đã chọn')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox'));
    await user.click(submitButton());

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/orders/o1/pay'));

    const hold = calls.find((c) => c.method === 'POST' && c.path === '/v1/sessions/s1/holds')!;
    const order = calls.find((c) => c.method === 'POST' && c.path === '/v1/orders')!;
    expect(hold.body).toEqual({
      seatIds: [],
      seatedZones: [{ zoneCode: 'A', quantity: 2 }],
      standing: [{ zoneCode: 'SAN', quantity: 1 }],
    });
    expect(order.body).toEqual({ holdId: 'h1' });
    expect(hold.headers['Idempotency-Key']).toBeTruthy();
    expect(order.headers['Idempotency-Key']).toBeTruthy();
    expect(order.headers['Idempotency-Key']).not.toBe(hold.headers['Idempotency-Key']);
  });

  it('giữ chỗ bị từ chối: câu tiếng Việt từ từ điển lỗi (không phải detail tiếng Anh), xoá lựa chọn, tải lại sơ đồ', async () => {
    const user = userEvent.setup();
    const { calls } = mount(
      routes({
        'POST /v1/sessions/s1/holds': () => ({
          status: 409,
          body: { code: 'SALES_CLOSED', detail: 'Sales window is closed' },
        }),
      }),
    );
    await screen.findByRole('heading', { name: 'Khu A', level: 3 });

    await user.click(plus('Khu A'));
    await user.click(screen.getByRole('checkbox'));
    await user.click(submitButton());

    const alert = await screen.findByRole('alert');
    expect(alert).not.toHaveTextContent('Sales window is closed');
    expect(alert.textContent?.trim().length).toBeGreaterThan(0);
    expect(screen.getByText('Chọn khu và số lượng vé để tiếp tục.')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    // Không đặt đơn khi giữ chỗ hỏng.
    expect(calls.some((c) => c.path === '/v1/orders')).toBe(false);
    await waitFor(() =>
      expect(calls.filter((c) => c.path === '/v1/sessions/s1/seats').length).toBeGreaterThanOrEqual(2),
    );
  });

  it('hết sạch chỗ thì báo "Suất này đã bán hết"', async () => {
    mount(
      routes({
        'GET /v1/sessions/s1/seats': () => ({
          status: 200,
          body: {
            ...SEAT_MAP,
            seats: SEAT_MAP.seats.map((s) => ({ ...s, status: 'SOLD' })),
            standingZones: SEAT_MAP.standingZones.map((z) => ({ ...z, available: 0 })),
          },
        }),
      }),
    );
    expect(await screen.findByText('Suất này đã bán hết.')).toBeInTheDocument();
  });

  it('tên khu chứa HTML do ban tổ chức đặt hiện ra thành chữ', async () => {
    const evil = '<img src=x onerror="window.__xss=1">';
    const { container } = mount(
      routes({
        'GET /v1/sessions/s1/seats': () => ({
          status: 200,
          body: {
            ...SEAT_MAP,
            seats: [{ ...seat('X-1', 'X', 'AVAILABLE', 100), sectionLabel: evil }],
            standingZones: [],
          },
        }),
      }),
    );
    expect(await screen.findByRole('heading', { name: evil, level: 3 })).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });
});
