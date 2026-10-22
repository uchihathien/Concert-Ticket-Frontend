import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithApi, type FakeCall } from '../../../lib/__tests__/harness';
import EventRulesPage from '../event-rules/page';

const EVENT_ID = '0a1b2c3d-4e5f-6789-abcd-ef0123456789';

const EXISTING = {
  eventId: EVENT_ID,
  eventTitle: 'Đêm nhạc Hạ',
  content: 'Không mang đồ ăn từ ngoài vào.',
  refundAllowed: true,
  refundWindowHours: 48,
  published: false,
  updatedAt: '2026-10-20T03:00:00Z',
};

function route(options: {
  rules?: typeof EXISTING | 'missing' | 'error';
  onSave?: (call: FakeCall) => void;
} = {}) {
  return (call: FakeCall) => {
    if (call.path.startsWith('/v1/platform/organizations?')) {
      return { status: 200, body: [{ id: 'org-1', slug: 'a', name: 'Sóng Live', status: 'ACTIVE', memberCount: 1 }] };
    }
    if (call.path === '/v1/organizations/org-1/events') {
      return { status: 200, body: [{ id: EVENT_ID, title: 'Đêm nhạc Hạ' }] };
    }
    if (call.path === `/v1/support/knowledge/rules/${EVENT_ID}`) {
      if (call.method === 'PUT') {
        options.onSave?.(call);
        return { status: 200, body: { ...EXISTING, ...(call.body as object), updatedAt: '2026-10-21T03:00:00Z' } };
      }
      if (options.rules === 'missing') return { status: 404, body: { code: 'EVENT_RULES_NOT_FOUND' } };
      if (options.rules === 'error') return { status: 503, body: { code: 'UNAVAILABLE' } };
      return { status: 200, body: options.rules ?? EXISTING };
    }
    return { status: 404, body: { code: 'NOT_FOUND' } };
  };
}

async function openViaManualId(user: ReturnType<typeof userEvent.setup>, id = EVENT_ID) {
  await user.type(screen.getByLabelText('Hoặc nhập mã sự kiện'), id);
  await user.click(screen.getByRole('button', { name: 'Mở' }));
}

describe('Quy định sự kiện — chọn sự kiện', () => {
  it('ban đầu chưa chọn sự kiện thì chỉ hiện gợi ý chọn, chưa gọi API quy định', async () => {
    const { calls } = renderWithApi(<EventRulesPage />, route());
    expect(await screen.findByText('Chưa chọn sự kiện')).toBeInTheDocument();
    expect(calls.some((c) => c.path.includes('/support/knowledge/rules'))).toBe(false);
  });

  it('ô Sự kiện bị khoá cho tới khi chọn tổ chức; chọn tổ chức rồi mới tải danh sách sự kiện', async () => {
    const user = userEvent.setup();
    const { calls } = renderWithApi(<EventRulesPage />, route());
    expect(screen.getByLabelText('Sự kiện')).toBeDisabled();

    await screen.findByRole('option', { name: 'Sóng Live' }, { timeout: 4000 });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tổ chức' }), 'org-1');
    await waitFor(() => expect(calls.some((c) => c.path === '/v1/organizations/org-1/events')).toBe(true));
    await waitFor(() => expect(screen.getByLabelText('Sự kiện')).toBeEnabled());

    await user.selectOptions(screen.getByLabelText('Sự kiện'), EVENT_ID);
    expect(await screen.findByLabelText(/Tên sự kiện/)).toHaveValue('Đêm nhạc Hạ');
  });

  it('nút Mở chỉ bật với UUID hợp lệ; mã sai hiện cảnh báo', async () => {
    const user = userEvent.setup();
    renderWithApi(<EventRulesPage />, route());
    const input = await screen.findByLabelText('Hoặc nhập mã sự kiện');
    expect(screen.getByRole('button', { name: 'Mở' })).toBeDisabled();

    await user.type(input, 'khong-phai-uuid');
    expect(screen.getByText('Mã sự kiện là một UUID.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mở' })).toBeDisabled();

    await user.clear(input);
    await user.type(input, `  ${EVENT_ID.toUpperCase()}  `);
    expect(screen.queryByText('Mã sự kiện là một UUID.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mở' })).toBeEnabled();
  });
});

describe('Quy định sự kiện — soạn và lưu', () => {
  it('đã có quy định: hiện huy hiệu trạng thái, nạp nội dung vào form', async () => {
    const user = userEvent.setup();
    renderWithApi(<EventRulesPage />, route());
    await openViaManualId(user);

    expect(await screen.findByText('Bản nháp')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Không mang đồ ăn từ ngoài vào.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Đêm nhạc Hạ')).toBeInTheDocument();
  });

  it('chưa có quy định (404 EVENT_RULES_NOT_FOUND) không phải lỗi: hiện form soạn mới, các nút bị khoá khi trống', async () => {
    const user = userEvent.setup();
    renderWithApi(<EventRulesPage />, route({ rules: 'missing' }));
    await openViaManualId(user);

    expect(await screen.findByText('Chưa có quy định — đang soạn mới')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /thử lại/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu nháp' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Công bố' })).toBeDisabled();
  });

  it('lỗi khác 404 thì hiện khối lỗi kèm thử lại, không mở form để ghi đè nhầm', async () => {
    const user = userEvent.setup();
    renderWithApi(<EventRulesPage />, route({ rules: 'error' }));
    await openViaManualId(user);

    expect(await screen.findByRole('button', { name: /thử lại/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Công bố' })).not.toBeInTheDocument();
  });

  it('soạn mới: lưu nháp gửi nội dung đã cắt khoảng trắng, published=false, chính sách hoàn vé mặc định false/0', async () => {
    const user = userEvent.setup();
    let saved: FakeCall | undefined;
    renderWithApi(<EventRulesPage />, route({ rules: 'missing', onSave: (c) => (saved = c) }));
    await openViaManualId(user);
    await screen.findByText('Chưa có quy định — đang soạn mới');

    await user.type(screen.getByLabelText(/Tên sự kiện/), '  Rock Fest  ');
    await user.type(screen.getByLabelText(/Nội dung quy định/), '  Cấm mang vật sắc nhọn.  ');
    await user.click(screen.getByRole('button', { name: 'Lưu nháp' }));

    expect(await screen.findByText('Đã lưu bản nháp')).toBeInTheDocument();
    expect(saved).toMatchObject({ method: 'PUT', path: `/v1/support/knowledge/rules/${EVENT_ID}` });
    expect(saved!.body).toEqual({
      eventTitle: 'Rock Fest',
      content: 'Cấm mang vật sắc nhọn.',
      refundAllowed: false,
      refundWindowHours: 0,
      published: false,
    });
  });

  it('sửa quy định đã có: GIỮ NGUYÊN chính sách hoàn vé đang lưu (48 giờ, cho hoàn) khi công bố', async () => {
    const user = userEvent.setup();
    let saved: FakeCall | undefined;
    renderWithApi(<EventRulesPage />, route({ onSave: (c) => (saved = c) }));
    await openViaManualId(user);

    const content = await screen.findByLabelText(/Nội dung quy định/);
    await user.clear(content);
    await user.type(content, 'Quy định đã sửa.');
    await user.click(screen.getByRole('button', { name: 'Công bố' }));

    expect(await screen.findByText('Đã công bố quy định')).toBeInTheDocument();
    expect(saved!.body).toEqual({
      eventTitle: 'Đêm nhạc Hạ',
      content: 'Quy định đã sửa.',
      refundAllowed: true,
      refundWindowHours: 48,
      published: true,
    });
  });

  it('xoá hết nội dung thì Lưu nháp và Công bố đều bị khoá; chỉ khoảng trắng cũng không tính', async () => {
    const user = userEvent.setup();
    renderWithApi(<EventRulesPage />, route());
    await openViaManualId(user);

    const content = await screen.findByLabelText(/Nội dung quy định/);
    await user.clear(content);
    await user.type(content, '   ');
    expect(screen.getByRole('button', { name: 'Lưu nháp' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Công bố' })).toBeDisabled();
  });

  it('bộ đếm ký tự cập nhật theo nội dung đang gõ', async () => {
    const user = userEvent.setup();
    renderWithApi(<EventRulesPage />, route({ rules: 'missing' }));
    await openViaManualId(user);
    await user.type(await screen.findByLabelText(/Nội dung quy định/), 'abcde');
    expect(screen.getByText(/5 \/ 20\.000 ký tự/)).toBeInTheDocument();
  });
});
