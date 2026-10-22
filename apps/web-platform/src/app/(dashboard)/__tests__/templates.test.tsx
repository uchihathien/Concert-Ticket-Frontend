import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithApi, type FakeCall } from '../../../lib/__tests__/harness';

const nav = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: nav.push }) }));

import TemplatesPage from '../templates/page';

const ROWS = [
  {
    id: 't1',
    code: 'ARENA-1',
    name: 'Nhà thi đấu',
    category: 'nhac-song',
    description: null,
    status: 'ACTIVE',
    zoneCount: 4,
    capacity: 12_500,
  },
  {
    id: 't2',
    code: 'THEATER',
    name: 'Nhà hát',
    category: 'THE_LOAI_LA',
    description: null,
    status: 'DRAFT',
    zoneCount: 0,
    capacity: 0,
  },
  {
    id: 't3',
    code: 'OLD',
    name: 'Khung cũ',
    category: 'nhac-song',
    description: null,
    status: 'ARCHIVED',
    zoneCount: 2,
    capacity: 800,
  },
];

function route(extra?: (call: FakeCall) => { status: number; body?: unknown } | null) {
  return (call: FakeCall) => {
    const handled = extra?.(call);
    if (handled) return handled;
    if (call.method === 'GET' && call.path.startsWith('/v1/platform/concert-templates')) {
      const status = new URL(call.path, 'http://x').searchParams.get('status');
      return { status: 200, body: status ? ROWS.filter((r) => r.status === status) : ROWS };
    }
    return { status: 404, body: { code: 'NOT_FOUND' } };
  };
}

beforeEach(() => nav.push.mockReset());

describe('Trang Khung mẫu — danh sách', () => {
  it('hiện tên, mã, nhãn trạng thái tiếng Việt, số khu và sức chứa có dấu phân cách nghìn', async () => {
    renderWithApi(<TemplatesPage />, route());
    const row = (await screen.findByRole('link', { name: 'Nhà thi đấu' })).closest('tr')!;
    expect(within(row).getByText('ARENA-1')).toBeInTheDocument();
    expect(within(row).getByText('Ca nhạc')).toBeInTheDocument();
    expect(within(row).getByText('Đang mở')).toBeInTheDocument();
    expect(within(row).getByText('4')).toBeInTheDocument();
    expect(within(row).getByText('12.500')).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: 'Nhà thi đấu' })).toHaveAttribute('href', '/templates/t1');
    expect(screen.getByText('3 khung')).toBeInTheDocument();
  });

  it('thể loại lạ chưa có nhãn thì hiện nguyên mã; trạng thái Nháp/Lưu trữ có nhãn riêng', async () => {
    renderWithApi(<TemplatesPage />, route());
    const draft = (await screen.findByText('Nhà hát')).closest('tr')!;
    expect(within(draft).getByText('THE_LOAI_LA')).toBeInTheDocument();
    expect(within(draft).getByText('Nháp')).toBeInTheDocument();
    const archived = screen.getByText('Khung cũ').closest('tr')!;
    expect(within(archived).getByText('Đã lưu trữ')).toBeInTheDocument();
  });

  it('lọc theo trạng thái gửi ?status=, đếm lại, và Xoá bộ lọc quay về danh sách đầy đủ', async () => {
    const user = userEvent.setup();
    const { calls } = renderWithApi(<TemplatesPage />, route());
    await screen.findByText('Nhà hát');
    expect(screen.getByRole('button', { name: 'Xoá bộ lọc' })).toBeDisabled();

    await user.selectOptions(screen.getByLabelText('Trạng thái'), 'ARCHIVED');
    await waitFor(() =>
      expect(calls.some((c) => c.path === '/v1/platform/concert-templates?status=ARCHIVED')).toBe(true),
    );
    expect(await screen.findByText('1 khung')).toBeInTheDocument();
    expect(screen.queryByText('Nhà hát')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Xoá bộ lọc' }));
    expect(await screen.findByText('Nhà hát')).toBeInTheDocument();
    expect(screen.getByText('3 khung')).toBeInTheDocument();
  });

  it('không có khung: thông báo rỗng khác nhau khi đang lọc và khi chưa lọc', async () => {
    const user = userEvent.setup();
    renderWithApi(
      <TemplatesPage />,
      () => ({ status: 200, body: [] }),
    );
    expect(await screen.findByText('Chưa có khung mẫu nào')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Trạng thái'), 'DRAFT');
    expect(await screen.findByText('Không có khung nào ở trạng thái này')).toBeInTheDocument();
  });

  it('API lỗi hiện khối lỗi kèm thử lại và không hiện bảng', async () => {
    renderWithApi(<TemplatesPage />, () => ({ status: 503, body: { code: 'UNAVAILABLE' } }));
    expect(await screen.findByRole('button', { name: /thử lại/i })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('Trang Khung mẫu — tạo khung', () => {
  async function openDialog(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: 'Tạo khung' }));
    return screen.findByRole('dialog', { name: 'Tạo khung mẫu' });
  }

  it('gửi tên đã cắt khoảng trắng, mô tả trống thành null, rồi chuyển sang trang khai khu', async () => {
    const user = userEvent.setup();
    const { calls } = renderWithApi(
      <TemplatesPage />,
      route((c) =>
        c.method === 'POST'
          ? { status: 200, body: { ...ROWS[0], id: 'moi-1', stage: null, zones: [] } }
          : null,
      ),
    );
    const dialog = await openDialog(user);
    await user.type(within(dialog).getByLabelText(/Mã khung/), 'SAN-VD-1');
    await user.type(within(dialog).getByLabelText(/Tên khung/), '  Sân vận động  ');
    await user.selectOptions(within(dialog).getByLabelText(/Thể loại/), 'nhac-song');
    await user.click(within(dialog).getByRole('button', { name: 'Tạo nháp' }));

    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/templates/moi-1'));
    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.path).toBe('/v1/platform/concert-templates');
    expect(post.body).toEqual({
      code: 'SAN-VD-1',
      name: 'Sân vận động',
      category: 'nhac-song',
      description: null,
    });
    expect(await screen.findByText('Đã tạo khung nháp')).toBeInTheDocument();
  });

  it('server từ chối (mã trùng) thì giữ hộp thoại, không chuyển trang', async () => {
    const user = userEvent.setup();
    renderWithApi(
      <TemplatesPage />,
      route((c) => (c.method === 'POST' ? { status: 409, body: { code: 'CONFLICT' } } : null)),
    );
    const dialog = await openDialog(user);
    await user.type(within(dialog).getByLabelText(/Mã khung/), 'TRUNG');
    await user.type(within(dialog).getByLabelText(/Tên khung/), 'Tên');
    await user.selectOptions(within(dialog).getByLabelText(/Thể loại/), 'nhac-song');
    await user.click(within(dialog).getByRole('button', { name: 'Tạo nháp' }));

    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Tạo khung mẫu' })).toBeInTheDocument());
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('mã khung chứa khoảng trắng hoặc ký tự lạ bị chặn ngay ở biểu mẫu, không gọi API', async () => {
    const user = userEvent.setup();
    const { calls } = renderWithApi(<TemplatesPage />, route());
    const dialog = await openDialog(user);
    await user.type(within(dialog).getByLabelText(/Mã khung/), 'SAN VD 1!');
    await user.type(within(dialog).getByLabelText(/Tên khung/), 'Tên');
    await user.selectOptions(within(dialog).getByLabelText(/Thể loại/), 'nhac-song');
    await user.click(within(dialog).getByRole('button', { name: 'Tạo nháp' }));

    expect(within(dialog).getByLabelText(/Mã khung/)).toBeInvalid();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('Huỷ đóng hộp thoại mà không gọi API tạo', async () => {
    const user = userEvent.setup();
    const { calls } = renderWithApi(<TemplatesPage />, route());
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Huỷ' }));
    expect(screen.queryByRole('dialog', { name: 'Tạo khung mẫu' })).not.toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });
});
