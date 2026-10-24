import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupportChat } from '../SupportChat';
import { renderWithApi, type FakeCall } from './harness';

vi.mock('@nexaticket/auth/client', () => ({
  useSessionState: () => ({ state: 'authenticated' }),
}));

const chips = {
  kind: 'CHOICES',
  step: 'ZONE',
  prompt: 'Bạn chọn hạng vé nào?',
  options: [
    { label: 'VIP', value: 'Hạng VIP', hint: '1.800.000đ · còn 12 chỗ' },
    { label: 'Phổ thông', value: 'Hạng Phổ thông', hint: '450.000đ' },
  ],
};

const proposal = {
  kind: 'BOOKING_PROPOSAL',
  id: 'p1',
  summary: '2 vé VIP · Đêm nhạc Trịnh · 20:00 ngày 20/11/2026',
  eventTitle: 'Đêm nhạc Trịnh',
  sessionStartsAt: '2026-11-20T13:00:00Z',
  zoneCode: 'A',
  quantity: 2,
  totalVnd: 3_600_000,
  expiresAt: new Date(Date.now() + 600_000).toISOString(),
};

/**
 * Lượt thứ n của POST /support trả `replies[n]`. Hội thoại (GET messages) trả lại thẻ của lượt gần nhất —
 * đúng như server, nơi thẻ đang mở được dựng lại từ đề xuất/bản nháp đã lưu.
 */
function mount(replies: unknown[]) {
  let n = 0;
  let current: unknown = null;
  return renderWithApi(<SupportChat />, (call: FakeCall) => {
    if (call.method === 'POST' && call.path === '/v1/chat/agent/support') {
      current = replies[Math.min(n, replies.length - 1)];
      n += 1;
      return {
        status: 200,
        body: { sessionId: 'cs1', answer: 'Mình hỏi tiếp nhé.', toolsUsed: [], action: current },
      };
    }
    if (call.method === 'GET' && call.path === '/v1/chat/agent/sessions/cs1/messages') {
      return { status: 200, body: { sessionId: 'cs1', handoff: null, messages: [], action: current } };
    }
    throw new Error(`Không có route giả cho ${call.method} ${call.path}`);
  });
}

function asked(calls: FakeCall[]) {
  return calls
    .filter((c) => c.method === 'POST' && c.path === '/v1/chat/agent/support')
    .map((c) => (c.body as { message: string }).message);
}

describe('SupportChat — đặt vé bằng chip', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    // jsdom không cài scrollTo cho phần tử; khung chat cuộn xuống tin mới nhất sau mỗi lượt.
    Element.prototype.scrollTo = vi.fn();
  });

  it('bấm chip gửi đúng value của chip, không sửa chữ', async () => {
    const { calls } = mount([chips, proposal]);

    fireEvent.change(screen.getByLabelText('Tin nhắn'), { target: { value: 'cho mình 2 vé đêm nhạc Trịnh' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi' }));

    const vip = await screen.findByRole('button', { name: /VIP.*còn 12 chỗ/ });
    fireEvent.click(vip);

    await waitFor(() => expect(asked(calls)).toEqual(['cho mình 2 vé đêm nhạc Trịnh', 'Hạng VIP']));
    expect(await screen.findByText('Đề xuất đặt vé')).toBeInTheDocument();
  });

  it('thẻ đề xuất có nút Đổi lựa chọn gửi câu đổi lựa chọn', async () => {
    const { calls } = mount([proposal, chips]);

    fireEvent.change(screen.getByLabelText('Tin nhắn'), { target: { value: 'đặt 2 vé VIP đêm nhạc Trịnh' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Đổi lựa chọn' }));

    await waitFor(() => expect(asked(calls)).toContain('Đổi lựa chọn'));
    expect(await screen.findByText('Bạn chọn hạng vé nào?')).toBeInTheDocument();
  });
});
