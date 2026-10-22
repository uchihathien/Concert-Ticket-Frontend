import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithApi, type FakeCall } from '../../../lib/__tests__/harness';
import KnowledgePage from '../knowledge/page';

const CHUNKS = [
  { id: 'k1', eventId: null, title: 'Giữ chỗ', content: 'Giữ chỗ trong 10 phút.', createdAt: null },
  { id: 'k2', eventId: null, title: 'Hoàn vé', content: 'Hoàn vé trong 48 giờ.', createdAt: null },
];

function route(options: {
  chunks?: unknown[] | 'error';
  preview?: unknown[];
  onCall?: (call: FakeCall) => void;
} = {}) {
  return (call: FakeCall) => {
    options.onCall?.(call);
    if (call.method === 'GET' && call.path.startsWith('/v1/support/knowledge/chunks')) {
      return options.chunks === 'error'
        ? { status: 503, body: { code: 'UNAVAILABLE' } }
        : { status: 200, body: options.chunks ?? CHUNKS };
    }
    if (call.method === 'POST' && call.path === '/v1/support/knowledge/chunks') {
      return { status: 200, body: { id: 'k3', eventId: null, ...(call.body as object), createdAt: null } };
    }
    if (call.method === 'DELETE') return { status: 204 };
    if (call.path.startsWith('/v1/support/knowledge/preview')) {
      return { status: 200, body: options.preview ?? [] };
    }
    return { status: 404, body: { code: 'NOT_FOUND' } };
  };
}

describe('Kho tri thức — danh sách', () => {
  it('hiện số đoạn trong tiêu đề và từng đoạn', async () => {
    renderWithApi(<KnowledgePage />, route());
    expect(await screen.findByText('Đã có trong kho (2)')).toBeInTheDocument();
    expect(screen.getByText('Giữ chỗ trong 10 phút.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xoá Hoàn vé' })).toBeInTheDocument();
  });

  it('kho trống nói rõ hệ quả (trợ lý "chưa tra được")', async () => {
    renderWithApi(<KnowledgePage />, route({ chunks: [] }));
    expect(await screen.findByText('Kho đang trống')).toBeInTheDocument();
    expect(screen.getByText(/mình chưa tra được/)).toBeInTheDocument();
  });

  it('API lỗi hiện thử lại chứ không bảo kho trống', async () => {
    renderWithApi(<KnowledgePage />, route({ chunks: 'error' }));
    expect(await screen.findByRole('button', { name: /thử lại/i })).toBeInTheDocument();
    expect(screen.queryByText('Kho đang trống')).not.toBeInTheDocument();
  });

  it('xoá một đoạn gọi DELETE đúng id và báo thành công', async () => {
    const user = userEvent.setup();
    const { calls } = renderWithApi(<KnowledgePage />, route());
    await user.click(await screen.findByRole('button', { name: 'Xoá Hoàn vé' }));

    expect(await screen.findByText('Đã xoá "Hoàn vé"')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE' && c.path === '/v1/support/knowledge/chunks/k2')).toBe(true);
  });
});

describe('Kho tri thức — thêm đoạn', () => {
  it('nút Thêm vào kho khoá khi thiếu tiêu đề hoặc nội dung (kể cả chỉ khoảng trắng)', async () => {
    const user = userEvent.setup();
    renderWithApi(<KnowledgePage />, route());
    const add = await screen.findByRole('button', { name: 'Thêm vào kho' });
    expect(add).toBeDisabled();

    await user.type(screen.getByLabelText(/Tiêu đề/), 'Chỉ có tiêu đề');
    expect(add).toBeDisabled();
    await user.type(screen.getByLabelText(/Nội dung/), '   ');
    expect(add).toBeDisabled();
    await user.type(screen.getByLabelText(/Nội dung/), 'abc');
    expect(add).toBeEnabled();
  });

  it('gửi tiêu đề/nội dung đã cắt khoảng trắng, xoá form và báo thành công', async () => {
    const user = userEvent.setup();
    const { calls } = renderWithApi(<KnowledgePage />, route());
    await user.type(await screen.findByLabelText(/Tiêu đề/), '  Đổi suất  ');
    await user.type(screen.getByLabelText(/Nội dung/), '  Được đổi suất trước 24 giờ.  ');
    await user.click(screen.getByRole('button', { name: 'Thêm vào kho' }));

    expect(await screen.findByText('Đã thêm đoạn tri thức')).toBeInTheDocument();
    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.body).toEqual({ title: 'Đổi suất', content: 'Được đổi suất trước 24 giờ.' });
    expect(screen.getByLabelText(/Tiêu đề/)).toHaveValue('');
    expect(screen.getByLabelText(/Nội dung/)).toHaveValue('');
  });
});

describe('Kho tri thức — thử một câu hỏi', () => {
  it('chưa gõ gì thì không gọi API preview; gõ xong mới gọi MỘT lần (hoãn 800ms) với câu hỏi đã mã hoá', async () => {
    const user = userEvent.setup();
    const { calls } = renderWithApi(<KnowledgePage />, route({ preview: [] }));
    await screen.findByText('Đã có trong kho (2)');
    expect(calls.some((c) => c.path.includes('/preview'))).toBe(false);

    await user.type(screen.getByLabelText('Khách hỏi gì'), 'giữ chỗ bao lâu?');
    expect(calls.some((c) => c.path.includes('/preview'))).toBe(false);

    await waitFor(() => expect(calls.filter((c) => c.path.includes('/preview'))).toHaveLength(1), {
      timeout: 3000,
    });
    expect(calls.find((c) => c.path.includes('/preview'))!.path).toBe(
      `/v1/support/knowledge/preview?q=${encodeURIComponent('giữ chỗ bao lâu?')}`,
    );
    expect(await screen.findByText('Không lấy được đoạn nào')).toBeInTheDocument();
  });

  it('đoạn vượt ngưỡng ghi "Dùng", đoạn không vượt ghi "Bị loại", khoảng cách làm tròn 3 số', async () => {
    const user = userEvent.setup();
    renderWithApi(
      <KnowledgePage />,
      route({
        preview: [
          { id: 'k1', eventId: null, title: 'Giữ chỗ', content: 'Giữ chỗ trong 10 phút.', distance: 0.12345, used: true },
          { id: 'k2', eventId: null, title: 'Hoàn vé', content: 'Hoàn vé trong 48 giờ.', distance: 0.9, used: false },
        ],
      }),
    );
    await user.type(await screen.findByLabelText('Khách hỏi gì'), 'giữ chỗ');
    const used = (await screen.findByText('khoảng cách 0.123', {}, { timeout: 3000 })).closest('li')!;
    expect(within(used).getByText('Dùng')).toBeInTheDocument();
    const dropped = screen.getByText('khoảng cách 0.900').closest('li')!;
    expect(within(dropped).getByText('Bị loại')).toBeInTheDocument();
    // Có đoạn được dùng thì không cảnh báo "không đoạn nào vượt ngưỡng".
    expect(screen.queryByText(/Không đoạn nào vượt ngưỡng/)).not.toBeInTheDocument();
  });

  it('mọi đoạn đều "Bị loại" thì cảnh báo trợ lý sẽ trả lời không kèm tri thức nền', async () => {
    const user = userEvent.setup();
    renderWithApi(
      <KnowledgePage />,
      route({
        preview: [{ id: 'k1', eventId: null, title: 'Giữ chỗ', content: 'x', distance: 0.8, used: false }],
      }),
    );
    await user.type(await screen.findByLabelText('Khách hỏi gì'), 'câu lạ');
    expect(await screen.findByText(/Không đoạn nào vượt ngưỡng/, {}, { timeout: 3000 })).toBeInTheDocument();
  });
});
