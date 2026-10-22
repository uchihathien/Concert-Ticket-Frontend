import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithApi, type FakeCall } from '../../../lib/__tests__/harness';
import SupportPage from '../support/page';

function handoff(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    sessionId: `s-${id}`,
    status: 'OPEN',
    trigger: 'AGENT_ESCALATION',
    intent: 'GENERAL',
    reason: `Lý do ${id}`,
    details: null,
    lastQuestion: null,
    customerId: 'c1',
    customerName: null,
    customerEmail: null,
    assignedAgentId: null,
    assignedAgentName: null,
    requestedAt: '2026-10-20T03:00:00Z',
    assignedAt: null,
    resolvedAt: null,
    waitingSeconds: 125,
    ...extra,
  };
}

function thread(h: ReturnType<typeof handoff>, extra: Record<string, unknown> = {}) {
  return {
    handoff: h,
    messages: [
      { role: 'USER', content: 'Tôi muốn hoàn vé', at: '2026-10-20T03:00:00Z' },
      { role: 'BOT', content: 'Mình chuyển cho nhân viên nhé', at: '2026-10-20T03:00:05Z' },
    ],
    checklist: [],
    ...extra,
  };
}

function route(options: {
  queue?: (call: FakeCall) => unknown[];
  thread?: ReturnType<typeof thread>;
  claim?: { status: number; body?: unknown };
  onCall?: (call: FakeCall) => void;
}) {
  return (call: FakeCall) => {
    options.onCall?.(call);
    if (call.method === 'GET' && call.path.startsWith('/v1/support/handoffs?')) {
      return { status: 200, body: options.queue?.(call) ?? [] };
    }
    if (options.thread && call.method === 'GET' && call.path === `/v1/support/handoffs/${options.thread.handoff.id}`) {
      return { status: 200, body: options.thread };
    }
    if (call.method === 'POST' && call.path.endsWith('/claim')) {
      return options.claim ?? { status: 200, body: options.thread };
    }
    if (call.method === 'POST' && call.path.endsWith('/messages')) {
      return { status: 200, body: options.thread };
    }
    if (call.method === 'POST' && call.path.endsWith('/resolve')) {
      return { status: 200, body: options.thread?.handoff };
    }
    return { status: 404, body: { code: 'NOT_FOUND' } };
  };
}

const queueParams = (calls: FakeCall[]) =>
  calls
    .filter((c) => c.path.startsWith('/v1/support/handoffs?'))
    .map((c) => new URL(c.path, 'http://x').searchParams);

// jsdom chưa có `Element.scrollTo`; trang gọi nó để cuộn xuống tin mới nhất.
const scrollTo = vi.fn();
beforeEach(() => {
  scrollTo.mockReset();
  Object.defineProperty(Element.prototype, 'scrollTo', { configurable: true, writable: true, value: scrollTo });
});

describe('Bàn hỗ trợ — hàng đợi', () => {
  it('mặc định lọc "Đang chờ" và gọi API với status=OPEN, không kèm q', async () => {
    const { calls } = renderWithApi(<SupportPage />, route({ queue: () => [] }));
    expect(await screen.findByText('Không có ai đang chờ')).toBeInTheDocument();
    expect(queueParams(calls)[0]!.get('status')).toBe('OPEN');
    expect(queueParams(calls)[0]!.has('q')).toBe(false);
    expect(screen.getByRole('button', { name: 'Đang chờ' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('đổi tab gửi status tương ứng; tab không phải "Đang chờ" rỗng thì dùng câu khác', async () => {
    const user = userEvent.setup();
    const { calls } = renderWithApi(<SupportPage />, route({ queue: () => [] }));
    await screen.findByText('Không có ai đang chờ');

    await user.click(screen.getByRole('button', { name: 'Đã xong' }));
    expect(await screen.findByText('Chưa có phiếu nào ở trạng thái này')).toBeInTheDocument();
    expect(queueParams(calls).at(-1)!.get('status')).toBe('RESOLVED');
    expect(screen.getByRole('button', { name: 'Đã xong' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Đang chờ' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('gõ tìm kiếm được hoãn 300ms: một lần gõ ra một request có q đã cắt khoảng trắng; không khớp thì báo từ khoá', async () => {
    const user = userEvent.setup();
    const { calls } = renderWithApi(<SupportPage />, route({ queue: () => [] }));
    await screen.findByText('Không có ai đang chờ');
    const before = queueParams(calls).length;

    await user.type(screen.getByLabelText('Tìm phiếu'), ' hoàn vé ');
    // Gõ xong ngay (chưa tới 300ms): chưa có request mới nào cho từng phím.
    expect(queueParams(calls).length).toBe(before);

    expect(await screen.findByText('Không có phiếu nào khớp')).toBeInTheDocument();
    const withQ = queueParams(calls).filter((p) => p.has('q'));
    expect(withQ).toHaveLength(1);
    expect(withQ[0]!.get('q')).toBe('hoàn vé');
    expect(screen.getByText(/chứa “hoàn vé”/)).toBeInTheDocument();
  });

  it('mỗi dòng hiện nhãn nguồn chuyển, ý định (ẩn với GENERAL), tên/email khách, thời gian chờ và người nhận', async () => {
    renderWithApi(
      <SupportPage />,
      route({
        queue: () => [
          handoff('a', {
            trigger: 'CUSTOMER_REQUEST',
            intent: 'REFUND',
            customerName: 'Lan',
            customerEmail: 'lan@example.com',
            lastQuestion: 'Cho tôi hoàn tiền',
            waitingSeconds: 3725,
          }),
          handoff('b', { status: 'ASSIGNED', intent: 'GENERAL', assignedAgentName: 'Minh', customerEmail: 'x@example.com' }),
          handoff('c', { status: 'RESOLVED', intent: 'INCIDENT', assignedAgentName: 'Hà' }),
          handoff('d'),
        ],
      }),
    );
    const list = await screen.findByRole('list');
    const rowOf = (reason: string) => within(list).getByText(reason).closest('li')!;

    const a = rowOf('Lý do a');
    expect(within(a).getByText('Khách yêu cầu')).toBeInTheDocument();
    expect(within(a).getByText('Hoàn vé')).toBeInTheDocument();
    expect(within(a).getByText('Lan · lan@example.com')).toBeInTheDocument();
    expect(within(a).getByText('“Cho tôi hoàn tiền”')).toBeInTheDocument();
    // 3725 giây = 1 giờ 2 phút 5 giây, do backend tính.
    expect(within(a).getByText('1:02:05')).toBeInTheDocument();

    const b = rowOf('Lý do b');
    expect(within(b).getByText('Đang xử lý')).toBeInTheDocument();
    expect(within(b).queryByText('Chung')).not.toBeInTheDocument();
    // Có email nhưng không có tên: vẫn hiện, với "Chưa rõ tên".
    expect(within(b).getByText('Chưa rõ tên · x@example.com')).toBeInTheDocument();
    expect(within(b).getByText(/Đang xử lý Minh/)).toBeInTheDocument();

    const c = rowOf('Lý do c');
    expect(within(c).getByText('Sự cố')).toBeInTheDocument();
    expect(within(c).getByText(/Đã xử lý bởi Hà/)).toBeInTheDocument();

    const d = rowOf('Lý do d');
    expect(within(d).getByText('Trợ lý chuyển')).toBeInTheDocument();
    // Thiếu cả tên lẫn email thì ẩn dòng khách, không hiện chữ chung chung.
    expect(within(d).queryByText(/Chưa rõ tên/)).not.toBeInTheDocument();
  });

  it('API lỗi hiện thử lại thay vì "Không có ai đang chờ"', async () => {
    renderWithApi(<SupportPage />, () => ({ status: 503, body: { code: 'UNAVAILABLE' } }));
    expect(await screen.findByRole('button', { name: /thử lại/i })).toBeInTheDocument();
    expect(screen.queryByText('Không có ai đang chờ')).not.toBeInTheDocument();
  });
});

describe('Bàn hỗ trợ — hội thoại', () => {
  const OPEN = handoff('a', { intent: 'INCIDENT' });

  async function openFirst(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByText('Lý do a'));
  }

  it('chưa chọn thì gợi ý chọn; phiếu chưa ai nhận hiện nút Nhận phiếu, chưa có ô trả lời', async () => {
    const user = userEvent.setup();
    renderWithApi(<SupportPage />, route({ queue: () => [OPEN], thread: thread(OPEN) }));
    expect(await screen.findByText('Chọn một cuộc trò chuyện')).toBeInTheDocument();
    await openFirst(user);

    expect(await screen.findByText('Tôi muốn hoàn vé')).toBeInTheDocument();
    expect(screen.getByText('Mình chuyển cho nhân viên nhé')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nhận phiếu' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Trả lời khách')).not.toBeInTheDocument();
  });

  it('mở hội thoại thì cuộn xuống tin mới nhất', async () => {
    const user = userEvent.setup();
    renderWithApi(<SupportPage />, route({ queue: () => [OPEN], thread: thread(OPEN) }));
    await openFirst(user);
    await screen.findByText('Tôi muốn hoàn vé');
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: expect.any(Number) }));
  });

  it('phiếu sự cố hiện checklist theo khung mẫu; phiếu thường không có', async () => {
    const user = userEvent.setup();
    renderWithApi(
      <SupportPage />,
      route({ queue: () => [OPEN], thread: thread(OPEN, { checklist: ['Kiểm tra cổng soát', 'Gọi trưởng ca'] }) }),
    );
    await openFirst(user);
    const aside = await screen.findByRole('complementary', { name: 'Việc cần kiểm' });
    expect(within(aside).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Kiểm tra cổng soát',
      'Gọi trưởng ca',
    ]);
  });

  it('nhận phiếu gọi POST .../claim; người khác nhận trước (409) thì báo thông tin và đóng hội thoại', async () => {
    const user = userEvent.setup();
    const { calls } = renderWithApi(
      <SupportPage />,
      route({
        queue: () => [OPEN],
        thread: thread(OPEN),
        claim: { status: 409, body: { code: 'HANDOFF_ALREADY_TAKEN' } },
      }),
    );
    await openFirst(user);
    await user.click(await screen.findByRole('button', { name: 'Nhận phiếu' }));

    expect(await screen.findByText('Phiếu này vừa được người khác nhận.')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST' && c.path === '/v1/support/handoffs/a/claim')).toBe(true);
    expect(await screen.findByText('Chọn một cuộc trò chuyện')).toBeInTheDocument();
  });

  it('phiếu đã nhận: có ô trả lời; Gửi bị khoá khi trống, gửi đã cắt khoảng trắng, Enter gửi còn Shift+Enter thì không', async () => {
    const user = userEvent.setup();
    const assigned = handoff('a', { status: 'ASSIGNED', assignedAgentName: 'Minh' });
    const { calls } = renderWithApi(
      <SupportPage />,
      route({ queue: () => [assigned], thread: thread(assigned) }),
    );
    await user.click(await screen.findByText('Lý do a'));
    const box = await screen.findByLabelText('Trả lời khách');
    expect(screen.getByRole('button', { name: 'Gửi' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Nhận phiếu' })).not.toBeInTheDocument();

    await user.type(box, '   ');
    expect(screen.getByRole('button', { name: 'Gửi' })).toBeDisabled();

    await user.type(box, 'Chào bạn{Shift>}{Enter}{/Shift}tiếp');
    expect(calls.some((c) => c.path.endsWith('/messages'))).toBe(false);
    expect(box).toHaveValue('   Chào bạn\ntiếp');

    await user.type(box, '{Enter}');
    await waitFor(() => expect(box).toHaveValue(''));
    const post = calls.find((c) => c.path === '/v1/support/handoffs/a/messages')!;
    expect(post.body).toEqual({ text: 'Chào bạn\ntiếp' });
  });

  it('Đánh dấu đã xong gọi POST .../resolve rồi đóng hội thoại', async () => {
    const user = userEvent.setup();
    const assigned = handoff('a', { status: 'ASSIGNED', assignedAgentName: 'Minh' });
    const { calls } = renderWithApi(
      <SupportPage />,
      route({ queue: () => [assigned], thread: thread(assigned) }),
    );
    await user.click(await screen.findByText('Lý do a'));
    await user.click(await screen.findByRole('button', { name: 'Đánh dấu đã xong' }));

    expect(await screen.findByText('Chọn một cuộc trò chuyện')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST' && c.path === '/v1/support/handoffs/a/resolve')).toBe(true);
  });
});
