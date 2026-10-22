import { createApiClient, type CheckinResult, type ScanResponse } from '@nexaticket/ts-sdk';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `fetch` giả truyền thẳng vào ApiClient thật (cùng cách với web-customer/harness.tsx): giữ nguyên
// đường đi component → SDK → dựng request, chỉ thay lớp mạng. MSW không dùng được trong jsdom vì
// fetch của undici từ chối AbortSignal của jsdom.
const net = vi.hoisted(() => ({
  calls: [] as Array<{ method: string; path: string; body: unknown }>,
  respond: null as null | (() => Response | Promise<Response>),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: createApiClient({
    baseUrl: 'http://gateway.test',
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      net.calls.push({
        method: init?.method ?? 'GET',
        path: url.pathname,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      });
      if (!net.respond) throw new Error('chưa khai báo phản hồi cho test này');
      return net.respond();
    }) as typeof fetch,
  }),
}));

// Server action kéo theo next-auth (cần runtime Next); thanh trên cùng không phải đối tượng test ở đây.
vi.mock('@/app/actions', () => ({ signOutStaff: vi.fn() }));

import { Scanner } from '../Scanner';

const PROPS = {
  eventSessionId: 'sess 1',
  organizationId: 'org/1',
  eventTitle: 'Đêm nhạc Hạ',
  venueName: 'Nhà hát Lớn',
  startsAt: '2026-11-01T12:00:00Z',
};

const SCAN_PATH = '/v1/organizations/org%2F1/sessions/sess%201/checkins';

function scanResponse(result: CheckinResult | string, extra: Partial<ScanResponse> = {}): ScanResponse {
  return {
    result: result as CheckinResult,
    seatCode: null,
    seatLabel: null,
    ticketTypeName: null,
    note: null,
    ...extra,
  };
}

function reply(status: number, body: unknown) {
  net.respond = () =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** Camera giả: detector đọc ra các giá trị trong `detected.codes`, getUserMedia thành công. */
const detected = { codes: [] as string[], detect: vi.fn() };

function installCamera(options: { torch?: boolean; denyCamera?: boolean; noDetector?: boolean } = {}) {
  const track = {
    stop: vi.fn(),
    getCapabilities: () => (options.torch ? { torch: true } : {}),
    applyConstraints: vi.fn().mockResolvedValue(undefined),
  };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: options.denyCamera
        ? vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError'))
        : vi.fn().mockResolvedValue(stream),
    },
  });
  detected.detect.mockImplementation(async () => detected.codes.map((rawValue) => ({ rawValue })));
  if (options.noDetector) {
    delete (window as unknown as Record<string, unknown>).BarcodeDetector;
  } else {
    (window as unknown as Record<string, unknown>).BarcodeDetector = class {
      detect = detected.detect;
    };
  }
  return track;
}

/** Cho effect khởi động camera (getUserMedia + play) chạy xong rồi mới đẩy đồng hồ. */
async function mountScanner() {
  render(<Scanner {...PROPS} />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

async function tick(ms = 250) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });
  act(() => {
    window.dispatchEvent(new Event(value ? 'online' : 'offline'));
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  net.calls.length = 0;
  net.respond = null;
  detected.codes = [];
  detected.detect.mockReset();
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete (window as unknown as Record<string, unknown>).BarcodeDetector;
});

describe('Scanner — ánh xạ kết quả quét ra màn hình', () => {
  // Sáu giá trị trong kiểu `CheckinResult` của SDK mà màn web hiểu.
  const CASES: Array<[CheckinResult, string, string, boolean]> = [
    ['ACCEPTED', 'MỜI VÀO', 'Vé hợp lệ.', true],
    ['ALREADY_CHECKED_IN', 'ĐÃ SOÁT RỒI', 'Mã này đã được dùng để vào trước đó.', false],
    ['REVOKED', 'VÉ ĐÃ HUỶ', 'Vé bị thu hồi hoặc đã hoàn tiền.', false],
    ['WRONG_SESSION', 'SAI SUẤT DIỄN', 'Vé thuộc một suất diễn khác.', false],
    ['INVALID_TOKEN', 'MÃ KHÔNG HỢP LỆ', 'Mã sai hoặc đã hết hạn.', false],
    ['NOT_FOUND', 'KHÔNG TÌM THẤY VÉ', 'Không có vé ứng với mã này.', false],
  ];

  it.each(CASES)('%s hiện "%s" với gợi ý và màu đúng', async (result, title, hint, accepted) => {
    installCamera();
    reply(200, scanResponse(result));
    detected.codes = ['QR-1'];
    await mountScanner();
    await tick();

    const panel = screen.getByRole('alert');
    expect(panel).toHaveTextContent(title);
    expect(panel).toHaveTextContent(hint);
    // Lớp `accepted` (xanh) chỉ dành cho ACCEPTED; mọi từ chối đi lớp `rejected` (đỏ).
    expect(screen.getByText(title).className).toContain(accepted ? 'acceptedText' : 'rejectedText');
    expect(panel.className).toContain(accepted ? 'accepted' : 'rejected');
    expect(panel.className).not.toContain(accepted ? 'rejected' : 'accepted');
  });

  it('ghi chú (note) của server thay cho gợi ý mặc định, kèm ghế và loại vé', async () => {
    installCamera();
    reply(
      200,
      scanResponse('ACCEPTED', {
        seatLabel: 'A-12',
        ticketTypeName: 'VIP',
        note: 'Khách VIP, dẫn lối cổng 2',
      }),
    );
    detected.codes = ['QR-1'];
    await mountScanner();
    await tick();

    const panel = screen.getByRole('alert');
    expect(panel).toHaveTextContent('A-12 · VIP');
    expect(panel).toHaveTextContent('Khách VIP, dẫn lối cổng 2');
    expect(panel).not.toHaveTextContent('Vé hợp lệ.');
  });

  it('không có nhãn ghế thì dùng mã ghế; vé không ghế thì không in dòng ghế/loại vé', async () => {
    installCamera();
    reply(200, scanResponse('ACCEPTED', { seatCode: 'B-3' }));
    detected.codes = ['QR-1'];
    await mountScanner();
    await tick();
    expect(screen.getByRole('alert')).toHaveTextContent('B-3');

    fireEvent.click(screen.getByRole('button', { name: 'QUÉT VÉ TIẾP THEO' }));
    reply(200, scanResponse('ACCEPTED', { ticketTypeName: 'Standing' }));
    await tick();
    expect(screen.getByRole('alert')).not.toHaveTextContent('Standing');
  });

  it('gửi mã tới đúng endpoint theo tổ chức/suất (đã mã hoá đường dẫn) kèm deviceId', async () => {
    installCamera();
    reply(200, scanResponse('ACCEPTED'));
    detected.codes = ['QR-abc'];
    await mountScanner();
    await tick();

    expect(net.calls).toEqual([
      { method: 'POST', path: SCAN_PATH, body: { qrToken: 'QR-abc', deviceId: 'web-scanner' } },
    ]);
  });

  // Backend (CheckinController#legacy) chỉ quy về 6 giá trị khi request KHÔNG có `direction`; web gửi
  // không có `direction` nên hiện tại an toàn. Nhưng nếu một giá trị khác lọt qua thì component phải
  // hiện gì đó chứ không để nhân viên nhìn màn trống giữa cổng. Hiện Scanner.tsx để `verdict = null`
  // và vẫn khoá đọc mã (paused=true) mà không có nút nào để quét tiếp: test này ĐỎ cho tới khi sửa.
  it.each(['EXITED', 'NOT_INSIDE', 'NOT_OPEN_YET', 'SESSION_ENDED', 'REENTRY_NOT_ALLOWED', 'GIA_TRI_LA'])(
    'kết quả lạ %s KHÔNG bao giờ để màn hình trống: phải có thông báo và nút quét tiếp',
    async (unknownResult) => {
      installCamera();
      reply(200, scanResponse(unknownResult, { note: 'Chưa tới giờ mở cổng' }));
      detected.codes = ['QR-1'];
      await mountScanner();
      await tick();

      expect(net.calls).toHaveLength(1);
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /QUÉT VÉ TIẾP THEO|THỬ LẠI/ })).toBeInTheDocument();
    },
  );
});

describe('Scanner — quét liên tiếp', () => {
  it('đang hiện kết quả thì dừng đọc: cùng một mã quét lặp nhiều lần chỉ gọi server một lần', async () => {
    installCamera();
    reply(200, scanResponse('ACCEPTED'));
    detected.codes = ['QR-same'];
    await mountScanner();
    await tick(250 * 6);

    expect(net.calls).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent('MỜI VÀO');
  });

  it('một lượt quét đang chờ server thì các nhịp đọc kế tiếp không gửi thêm request', async () => {
    installCamera();
    let release!: (response: Response) => void;
    net.respond = () => new Promise<Response>((resolve) => (release = resolve));
    detected.codes = ['QR-slow'];
    await mountScanner();
    await tick(250 * 5);

    expect(net.calls).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('Đang xác thực với máy chủ');
    expect(screen.getByText('ĐANG KIỂM TRA VÉ...')).toBeInTheDocument();

    await act(async () => {
      release(new Response(JSON.stringify(scanResponse('ACCEPTED')), { status: 200 }));
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.getByRole('alert')).toHaveTextContent('MỜI VÀO');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('bấm "QUÉT VÉ TIẾP THEO" xoá kết quả và đọc lại được mã kế tiếp', async () => {
    installCamera();
    reply(200, scanResponse('ACCEPTED'));
    detected.codes = ['QR-1'];
    await mountScanner();
    await tick();
    expect(screen.getByRole('alert')).toHaveTextContent('MỜI VÀO');

    detected.codes = ['QR-2'];
    reply(200, scanResponse('ALREADY_CHECKED_IN'));
    fireEvent.click(screen.getByRole('button', { name: 'QUÉT VÉ TIẾP THEO' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await tick();

    expect(screen.getByRole('alert')).toHaveTextContent('ĐÃ SOÁT RỒI');
    expect(net.calls.map((c) => (c.body as { qrToken: string }).qrToken)).toEqual(['QR-1', 'QR-2']);
  });

  it('detector ném lỗi ở một nhịp thì bỏ qua nhịp đó và vẫn đọc được ở nhịp sau', async () => {
    installCamera();
    reply(200, scanResponse('ACCEPTED'));
    detected.detect
      .mockRejectedValueOnce(new Error('frame hỏng'))
      .mockResolvedValue([{ rawValue: 'QR-ok' }]);
    await mountScanner();
    await tick(250);
    expect(net.calls).toHaveLength(0);
    await tick(250);
    expect(screen.getByRole('alert')).toHaveTextContent('MỜI VÀO');
    expect(net.calls).toHaveLength(1);
  });

  it('khung hình không có mã thì không gọi server', async () => {
    installCamera();
    detected.codes = [];
    await mountScanner();
    await tick(250 * 4);
    expect(net.calls).toHaveLength(0);
    expect(screen.getByText('ĐƯA MÃ QR VÀO KHUNG')).toBeInTheDocument();
  });
});

describe('Scanner — lỗi khi gọi server', () => {
  it.each([
    [401, 'Phiên đăng nhập đã hết hạn'],
    [403, 'Tài khoản chưa được cấp quyền soát vé cho tổ chức này.'],
    [500, 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'],
  ])('HTTP %s hiện thông báo đúng và nút THỬ LẠI', async (status, message) => {
    installCamera();
    reply(status, { code: 'X', message: 'x' });
    detected.codes = ['QR-1'];
    await mountScanner();
    await tick();

    const panel = screen.getByRole('alert');
    expect(panel).toHaveTextContent('KHÔNG GỬI ĐƯỢC');
    expect(panel).toHaveTextContent(message);
    expect(screen.getByRole('button', { name: 'THỬ LẠI' })).toBeInTheDocument();
    // Lỗi không phải "vé bị từ chối": tuyệt đối không hiện nhãn kết quả vé.
    expect(panel).not.toHaveTextContent('MỜI VÀO');
  });

  it('mạng đứt hẳn (fetch ném lỗi) hiện thông báo mất kết nối, rồi THỬ LẠI cho quét lại', async () => {
    installCamera();
    net.respond = () => {
      throw new TypeError('Failed to fetch');
    };
    detected.codes = ['QR-1'];
    await mountScanner();
    await tick();
    expect(screen.getByRole('alert')).toHaveTextContent('Không kết nối được máy chủ');

    reply(200, scanResponse('ACCEPTED'));
    fireEvent.click(screen.getByRole('button', { name: 'THỬ LẠI' }));
    await tick();
    expect(screen.getByRole('alert')).toHaveTextContent('MỜI VÀO');
    expect(net.calls).toHaveLength(2);
  });
});

describe('Scanner — nhập tay mã vé khi QR hỏng', () => {
  async function submitManual(value: string) {
    fireEvent.change(screen.getByLabelText('Dán mã vé'), { target: { value } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'SOÁT' }));
      await vi.advanceTimersByTimeAsync(1);
    });
  }

  it('gửi mã đã cắt khoảng trắng hai đầu', async () => {
    installCamera();
    reply(200, scanResponse('ACCEPTED'));
    await mountScanner();
    await submitManual('   TOKEN-TAY  ');

    expect(screen.getByRole('alert')).toHaveTextContent('MỜI VÀO');
    expect(net.calls).toHaveLength(1);
    expect((net.calls[0]!.body as { qrToken: string }).qrToken).toBe('TOKEN-TAY');
  });

  it('ô trống hoặc chỉ có khoảng trắng thì không gọi server', async () => {
    installCamera();
    await mountScanner();
    await submitManual('    ');
    expect(net.calls).toHaveLength(0);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('khi đang hiện kết quả thì ô nhập tay biến mất cho tới khi bấm quét tiếp', async () => {
    installCamera();
    reply(200, scanResponse('REVOKED'));
    await mountScanner();
    await submitManual('X');
    expect(screen.getByRole('alert')).toHaveTextContent('VÉ ĐÃ HUỶ');
    expect(screen.queryByLabelText('Dán mã vé')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'QUÉT VÉ TIẾP THEO' }));
    expect(screen.getByLabelText('Dán mã vé')).toBeInTheDocument();
  });

  it('mất mạng: hiện dải cảnh báo, khoá nút SOÁT và không gửi mã; có mạng lại thì mở khoá', async () => {
    installCamera();
    await mountScanner();
    setOnline(false);

    expect(screen.getByText('Mất mạng — tạm dừng soát vé')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'SOÁT' })).toBeDisabled();

    // Gõ Enter trong ô vẫn gửi form: logic phải tự chặn chứ không chỉ dựa vào nút bị khoá.
    fireEvent.change(screen.getByLabelText('Dán mã vé'), { target: { value: 'X' } });
    const form = screen.getByLabelText('Dán mã vé').closest('form')!;
    await act(async () => {
      form.requestSubmit();
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(net.calls).toHaveLength(0);

    setOnline(true);
    expect(screen.queryByText('Mất mạng — tạm dừng soát vé')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'SOÁT' })).toBeEnabled();
  });
});

describe('Scanner — camera và đèn pin', () => {
  it('trình duyệt không có BarcodeDetector: báo dùng ô dán mã, ô dán vẫn có', async () => {
    installCamera({ noDetector: true });
    await mountScanner();
    expect(screen.getByText('Không dùng được camera')).toBeInTheDocument();
    expect(screen.getByText(/chưa hỗ trợ quét mã/)).toBeInTheDocument();
    expect(screen.getByLabelText('Dán mã vé')).toBeInTheDocument();
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });

  it('bị từ chối quyền camera: báo lỗi quyền, vẫn dùng được ô dán mã', async () => {
    installCamera({ denyCamera: true });
    await mountScanner();
    expect(screen.getByText(/Cho phép quyền camera/)).toBeInTheDocument();
    expect(screen.getByLabelText('Dán mã vé')).toBeInTheDocument();
  });

  it('chỉ hiện nút đèn pin khi track hỗ trợ torch, và bật gọi applyConstraints', async () => {
    const track = installCamera({ torch: true });
    await mountScanner();
    const button = screen.getByRole('button', { name: 'Bật đèn pin' });
    expect(button).toHaveTextContent('ĐÈN TẮT');

    await act(async () => {
      fireEvent.click(button);
    });
    expect(track.applyConstraints).toHaveBeenLastCalledWith({ advanced: [{ torch: true }] });
    expect(screen.getByRole('button', { name: 'Tắt đèn pin' })).toHaveTextContent('ĐÈN BẬT');
  });

  it('không hỗ trợ torch thì không có nút đèn pin', async () => {
    installCamera({ torch: false });
    await mountScanner();
    expect(screen.queryByRole('button', { name: /đèn pin/ })).not.toBeInTheDocument();
  });

  it('bật đèn thất bại thì ẩn nút thay vì treo trạng thái sai', async () => {
    const track = installCamera({ torch: true });
    track.applyConstraints.mockRejectedValue(new Error('no torch'));
    await mountScanner();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Bật đèn pin' }));
    });
    expect(screen.queryByRole('button', { name: /đèn pin/ })).not.toBeInTheDocument();
  });

  it('gỡ component thì dừng camera', async () => {
    const track = installCamera();
    await mountScanner();
    cleanup();
    expect(track.stop).toHaveBeenCalled();
  });

  it('hiện tên sự kiện và địa điểm; thiếu tên sự kiện thì dùng mã suất', async () => {
    installCamera();
    const { unmount } = render(<Scanner {...PROPS} />);
    expect(screen.getByText('Đêm nhạc Hạ')).toBeInTheDocument();
    expect(screen.getByText(/Nhà hát Lớn · /)).toBeInTheDocument();
    unmount();

    render(<Scanner {...PROPS} eventTitle="" venueName="" startsAt="" />);
    expect(screen.getByText('sess 1')).toBeInTheDocument();
  });
});

describe('Scanner — không có chế độ Vào/Ra', () => {
  it('web-scanner chỉ quét Vào: không gửi `direction` và không có công tắc Ra', async () => {
    installCamera();
    reply(200, scanResponse('ACCEPTED'));
    detected.codes = ['QR-1'];
    await mountScanner();
    await tick();

    // Thiếu `direction` là cách backend nhận ra "máy đời đầu" và quy kết quả về 6 giá trị.
    expect(Object.keys(net.calls[0]!.body as object).sort()).toEqual(['deviceId', 'qrToken']);
    expect(screen.queryByRole('button', { name: /^RA$/ })).not.toBeInTheDocument();
  });
});
