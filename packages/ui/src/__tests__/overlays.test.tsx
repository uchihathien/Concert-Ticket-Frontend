import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Countdown } from '../components/Countdown';
import { Drawer, Modal } from '../components/Dialog';
import { MoneyText } from '../components/MoneyText';
import { TicketPoster } from '../components/TicketPoster';
import { ToastProvider, useToast } from '../components/Toast';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

describe('Countdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-01T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('đi từ bình thường → cảnh báo → hết giờ, và gọi onExpire đúng một lần', () => {
    const onExpire = vi.fn();
    render(<Countdown deadline="2026-11-01T12:02:00Z" warnBelowMs={60_000} onExpire={onExpire} />);
    const timer = screen.getByRole('timer');

    expect(timer).toHaveTextContent('02:00');
    expect(timer).toHaveAttribute('data-state', 'normal');
    expect(timer).toHaveAttribute('aria-label', 'Còn 02:00');

    act(() => vi.advanceTimersByTime(61_000));
    expect(timer).toHaveAttribute('data-state', 'warn');

    act(() => vi.advanceTimersByTime(60_000));
    expect(timer).toHaveTextContent('00:00');
    expect(timer).toHaveAttribute('data-state', 'expired');
    expect(timer).toHaveAttribute('aria-label', 'Đã hết giờ');

    act(() => vi.advanceTimersByTime(10_000));
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('không đọc lại từng giây cho trình đọc màn hình', () => {
    render(<Countdown deadline="2026-11-01T12:10:00Z" />);
    expect(screen.getByRole('timer')).toHaveAttribute('aria-live', 'off');
  });
});

describe('Modal / Drawer', () => {
  it('Esc (sự kiện cancel) đóng modal thường', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Xác nhận">
        Nội dung
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { hidden: true });
    const cancel = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(cancel);
    expect(onClose).toHaveBeenCalledOnce();
    // preventDefault để chính React quyết định đóng, không để trình duyệt tự đóng sau lưng state.
    expect(cancel.defaultPrevented).toBe(true);
  });

  it('modal hệ quả nặng (dismissible=false): Esc và bấm nền đều không đóng, không có nút ×', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Huỷ đơn" dismissible={false}>
        Bạn chắc chứ?
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { hidden: true });
    const cancel = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(cancel);
    fireEvent.click(dialog);

    expect(onClose).not.toHaveBeenCalled();
    expect(cancel.defaultPrevented).toBe(true);
    expect(screen.queryByRole('button', { name: 'Đóng', hidden: true })).toBeNull();
  });

  it('bấm nền đóng, bấm vào nội dung bên trong thì không', () => {
    const onClose = vi.fn();
    render(
      <Drawer open onClose={onClose} title="Bộ lọc" footer={<button type="button">Áp dụng</button>}>
        <p>Bên trong</p>
      </Drawer>,
    );
    fireEvent.click(screen.getByText('Bên trong'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('dialog', { hidden: true }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('tiêu đề gắn với dialog qua aria-labelledby; nút × gọi onClose', async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Đổi vé">
        x
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { hidden: true });
    const heading = screen.getByRole('heading', { name: 'Đổi vé', hidden: true });
    expect(dialog.getAttribute('aria-labelledby')).toBe(heading.id);
    expect(dialog).toHaveProperty('open', true);

    await userEvent.click(screen.getByRole('button', { name: 'Đóng', hidden: true }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('open=false thì dialog đóng lại', () => {
    const { rerender } = render(
      <Modal open onClose={() => {}} title="T">
        x
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { hidden: true }) as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    rerender(
      <Modal open={false} onClose={() => {}} title="T">
        x
      </Modal>,
    );
    expect(dialog.open).toBe(false);
  });
});

function ToastHarness({ onReady }: { onReady: (api: ReturnType<typeof useToast>) => void }) {
  onReady(useToast());
  return null;
}

describe('Toast', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function mount() {
    let api!: ReturnType<typeof useToast>;
    render(
      <ToastProvider>
        <ToastHarness onReady={(value) => (api = value)} />
      </ToastProvider>,
    );
    return () => api;
  }

  it('tự đóng sau 5 giây mặc định; duration=0 thì ở lại tới khi người dùng bấm', () => {
    vi.useFakeTimers();
    const api = mount();
    act(() => {
      api().show({ message: 'Đã lưu', tone: 'success' });
      api().show({ message: 'Cần xem', duration: 0 });
    });
    expect(screen.getAllByRole('status')).toHaveLength(2);

    act(() => vi.advanceTimersByTime(5_000));
    expect(screen.queryByText('Đã lưu')).toBeNull();
    expect(screen.getByText('Cần xem')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Đóng thông báo' }));
    expect(screen.queryByText('Cần xem')).toBeNull();
  });

  it('lỗi dùng role=alert + assertive; mã đã biết hiện ở dòng phụ, mã lạ thì không', () => {
    const api = mount();
    act(() => {
      api().showError({ code: 'SEAT_UNAVAILABLE' });
      api().showError({ code: 'MA_LA_HOAC_CHUOI_KY_THUAT' });
    });
    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(2);
    expect(alerts[0]).toHaveAttribute('aria-live', 'assertive');
    expect(alerts[0]).toHaveTextContent('SEAT_UNAVAILABLE');
    expect(alerts[1]).not.toHaveTextContent('MA_LA_HOAC_CHUOI_KY_THUAT');
  });

  it('nút hành động chạy callback rồi đóng thông báo', () => {
    const retry = vi.fn();
    const api = mount();
    act(() => api().show({ message: 'Mất mạng', actionLabel: 'Thử lại', onAction: retry }));
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.queryByText('Mất mạng')).toBeNull();
  });

  it('nội dung thông báo là chữ, không phải HTML', () => {
    const api = mount();
    act(() => api().show({ message: '<img src=x onerror="window.__xss=1">' }));
    expect(screen.getByRole('status')).toHaveTextContent('<img src=x onerror="window.__xss=1">');
    expect(document.querySelector('img')).toBeNull();
  });

  it('useToast ngoài provider ném lỗi rõ ràng', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useToast())).toThrow(/ToastProvider/);
  });
});

describe('MoneyText', () => {
  it('đọc thành "đồng" cho trình đọc màn hình, nhãn tuỳ chỉnh thắng', () => {
    const { rerender } = render(<MoneyText amountVnd={1_500_000} />);
    expect(screen.getByLabelText('1.500.000 đồng')).toHaveTextContent(/1\.500\.000/);
    rerender(<MoneyText amountVnd={0} label="Miễn phí" />);
    expect(screen.getByLabelText('Miễn phí')).toBeInTheDocument();
  });
});

describe('useDebouncedValue', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('trả giá trị đầu ngay, chỉ lần gõ cuối cùng sống tới hết nhịp', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 300), {
      initialProps: { v: 'N' },
    });
    expect(result.current).toBe('N');

    rerender({ v: 'Ng' });
    act(() => vi.advanceTimersByTime(200));
    rerender({ v: 'Nguyễn' });
    act(() => vi.advanceTimersByTime(200));
    // 400ms kể từ phím đầu nhưng mới 200ms kể từ phím cuối — chưa đổi.
    expect(result.current).toBe('N');

    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe('Nguyễn');
  });
});

describe('TicketPoster — chuỗi do người dùng đặt', () => {
  it('tên sự kiện, tên người giữ vé chứa thẻ HTML được vẽ thành CHỮ, không thành phần tử', () => {
    const payload = '<img src=x onerror="window.__xss=1">';
    const { container } = render(
      <TicketPoster
        eventTitle={payload}
        sessionAt="01/11/2026 · 19:00"
        venueLine={'</text><script>window.__xss=2</script>'}
        zoneCode="A"
        seatLabel="1"
        ticketTypeName="<b>VIP</b>"
        holderName="<svg onload=alert(1)>"
        ticketCode="NT-1"
        qrToken="tok"
      />,
    );

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    // Chỉ có đúng một <svg> — cái của chính vé.
    expect(container.querySelectorAll('svg')).toHaveLength(1);
    expect(container.textContent).toContain('<img');
    expect((window as unknown as { __xss?: number }).__xss).toBeUndefined();
  });
});
