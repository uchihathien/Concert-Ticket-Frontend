import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithApi, type FakeCall } from '../../../lib/__tests__/harness';
import type { TemplateDetail } from '../../../lib/concert-templates';

const nav = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useParams: () => ({ templateId: 't1' }),
  useRouter: () => ({ replace: nav.replace }),
}));

import TemplateDetailPage from '../templates/[templateId]/page';

const GRID_LAYOUT = {
  shape: 'GRID',
  originX: 10,
  originY: 20,
  rotationDeg: 15,
  innerRadius: null,
  startAngleDeg: null,
  endAngleDeg: null,
};

function zone(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    zoneCode: id.toUpperCase(),
    name: `Khu ${id}`,
    kind: 'SEATED',
    rowCount: 4,
    seatsPerRow: 10,
    capacity: null,
    seatCount: 40,
    sortOrder: 0,
    suggestedPriceVnd: 500_000,
    layout: GRID_LAYOUT,
    ...extra,
  };
}

function detail(extra: Partial<TemplateDetail> | Record<string, unknown> = {}): TemplateDetail {
  return {
    id: 't1',
    code: 'ARENA',
    name: 'Nhà thi đấu',
    category: 'nhac-song',
    description: null,
    status: 'DRAFT',
    capacity: 40,
    stage: { shape: 'RECT', x: 1, y: 2, width: 30, height: 5 },
    zones: [zone('a')],
    ...extra,
  } as unknown as TemplateDetail;
}

function route(template: TemplateDetail, extra?: (call: FakeCall) => { status: number; body?: unknown } | null) {
  return (call: FakeCall) => {
    const handled = extra?.(call);
    if (handled) return handled;
    if (call.method === 'GET' && call.path === '/v1/platform/concert-templates/t1') {
      return { status: 200, body: template };
    }
    return { status: 404, body: { code: 'NOT_FOUND' } };
  };
}

beforeEach(() => nav.replace.mockReset());

describe('Chi tiết khung — nút theo trạng thái', () => {
  it('Nháp có khu: có "Mở cho tổ chức" và "Lưu trữ", không có "Về nháp"', async () => {
    renderWithApi(<TemplateDetailPage />, route(detail()));
    expect(await screen.findByRole('button', { name: /Mở cho tổ chức/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Lưu trữ/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Về nháp để sửa/ })).not.toBeInTheDocument();
  });

  it('Nháp nhưng chưa có khu: nút mở bị khoá kèm lý do', async () => {
    renderWithApi(<TemplateDetailPage />, route(detail({ zones: [] })));
    const open = await screen.findByRole('button', { name: /Mở cho tổ chức/ });
    expect(open).toBeDisabled();
    expect(open).toHaveAttribute('title', 'Khai ít nhất một khu trước khi mở');
    expect(screen.getByText(/Khung chưa có khu nào/)).toBeInTheDocument();
  });

  it('Đang mở: có "Về nháp để sửa" và cảnh báo, không có "Mở cho tổ chức"', async () => {
    renderWithApi(<TemplateDetailPage />, route(detail({ status: 'ACTIVE' })));
    expect(await screen.findByRole('button', { name: /Về nháp để sửa/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mở cho tổ chức/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Nên đưa về nháp trước khi sửa/)).toBeInTheDocument();
  });

  it('Đã lưu trữ: không còn nút "Lưu trữ", vẫn mở lại được', async () => {
    renderWithApi(<TemplateDetailPage />, route(detail({ status: 'ARCHIVED' })));
    expect(await screen.findByRole('button', { name: /Mở cho tổ chức/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Lưu trữ/ })).not.toBeInTheDocument();
  });

  it('bấm Lưu trữ gọi POST .../archive và báo thành công', async () => {
    const user = userEvent.setup();
    const { calls } = renderWithApi(
      <TemplateDetailPage />,
      route(detail(), (c) =>
        c.method === 'POST' ? { status: 200, body: detail({ status: 'ARCHIVED' }) } : null,
      ),
    );
    await user.click(await screen.findByRole('button', { name: /Lưu trữ/ }));
    expect(await screen.findByText('Đã lưu trữ khung')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST' && c.path === '/v1/platform/concert-templates/t1/archive')).toBe(true);
  });

  it('không có sơ đồ khu nào bị "TABLE" thì nút sửa bảng khu bật; có khu bàn thì khoá', async () => {
    const first = renderWithApi(<TemplateDetailPage />, route(detail()));
    expect(await screen.findByRole('button', { name: /Sửa bảng khu/ })).toBeEnabled();
    first.unmount();

    renderWithApi(
      <TemplateDetailPage />,
      route(detail({ zones: [zone('b', { layout: { ...GRID_LAYOUT, shape: 'TABLE' } })] })),
    );
    expect(await screen.findByRole('button', { name: /Sửa bảng khu/ })).toBeDisabled();
  });

  it('bảng khu hiện loại, số chỗ và giá gợi ý; khu không có giá hiện "—"; sắp theo sortOrder', async () => {
    renderWithApi(
      <TemplateDetailPage />,
      route(
        detail({
          zones: [
            zone('b', { sortOrder: 1, kind: 'STANDING', rowCount: null, seatsPerRow: null, seatCount: 2000, suggestedPriceVnd: null }),
            zone('a', { sortOrder: 0 }),
          ],
        }),
      ),
    );
    const table = await screen.findByRole('table', { name: 'Khu vực của khung' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByText('Ngồi · 4 hàng × 10')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('500.000 ₫')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Đứng')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('2.000')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('—')).toBeInTheDocument();
  });

  it('API lỗi hiện khối lỗi, có đường quay lại danh sách', async () => {
    renderWithApi(<TemplateDetailPage />, () => ({ status: 503, body: { code: 'UNAVAILABLE' } }));
    expect(await screen.findByRole('button', { name: /thử lại/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Mọi khung mẫu/ })).toHaveAttribute('href', '/templates');
  });
});

describe('Chi tiết khung — xoá', () => {
  it('xoá thành công thì báo và quay về danh sách', async () => {
    const user = userEvent.setup();
    const { calls } = renderWithApi(
      <TemplateDetailPage />,
      route(detail(), (c) => (c.method === 'DELETE' ? { status: 204 } : null)),
    );
    await user.click(await screen.findByRole('button', { name: /^Xoá$/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Xoá khung mẫu?' });
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    await user.click(within(dialog).getByRole('button', { name: 'Xoá vĩnh viễn' }));

    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/templates'));
    expect(calls.some((c) => c.method === 'DELETE' && c.path === '/v1/platform/concert-templates/t1')).toBe(true);
  });

  it('khung đang được dùng (server từ chối) thì đóng hộp thoại và KHÔNG điều hướng', async () => {
    const user = userEvent.setup();
    renderWithApi(
      <TemplateDetailPage />,
      route(detail(), (c) => (c.method === 'DELETE' ? { status: 409, body: { code: 'TEMPLATE_IN_USE' } } : null)),
    );
    await user.click(await screen.findByRole('button', { name: /^Xoá$/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Xoá khung mẫu?' });
    await user.click(within(dialog).getByRole('button', { name: 'Xoá vĩnh viễn' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Xoá khung mẫu?' })).not.toBeInTheDocument());
    expect(nav.replace).not.toHaveBeenCalled();
  });
});

describe('Chi tiết khung — sửa thông tin', () => {
  it('thể loại cũ không còn trong danh mục vẫn được giữ làm lựa chọn; lưu gửi PATCH với giá trị đã cắt khoảng trắng', async () => {
    const user = userEvent.setup();
    const { calls } = renderWithApi(
      <TemplateDetailPage />,
      route(detail({ category: 'the-loai-cu' }), (c) =>
        c.method === 'PATCH' ? { status: 200, body: detail() } : null,
      ),
    );
    await user.click(await screen.findByRole('button', { name: /Sửa thông tin/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Sửa thông tin khung' });
    expect(within(dialog).getByRole('option', { name: 'the-loai-cu' })).toBeInTheDocument();

    const name = within(dialog).getByLabelText(/Tên khung/);
    await user.clear(name);
    await user.type(name, '  Tên mới  ');
    await user.click(within(dialog).getByRole('button', { name: 'Lưu' }));

    expect(await screen.findByText('Đã lưu thông tin khung')).toBeInTheDocument();
    const patch = calls.find((c) => c.method === 'PATCH')!;
    expect(patch.body).toEqual({ name: 'Tên mới', category: 'the-loai-cu', description: '' });
  });
});

describe('Chi tiết khung — sửa bảng khu', () => {
  async function openEditor(user: ReturnType<typeof userEvent.setup>, template = detail(), extra?: Parameters<typeof route>[1]) {
    const utils = renderWithApi(<TemplateDetailPage />, route(template, extra));
    await user.click(await screen.findByRole('button', { name: /Sửa bảng khu/ }));
    return utils;
  }
  const errorText = () => screen.getByRole('alert').textContent;

  it('lưu nguyên bảng cũ: gửi lại đủ hình học khu và sân khấu, đánh sortOrder theo thứ tự', async () => {
    const user = userEvent.setup();
    const { calls } = await openEditor(user, detail(), (c) =>
      c.method === 'PUT' ? { status: 200, body: detail() } : null,
    );
    await user.click(screen.getByRole('button', { name: 'Lưu bảng khu' }));

    expect(await screen.findByText('Đã lưu bảng khu')).toBeInTheDocument();
    const put = calls.find((c) => c.method === 'PUT')!;
    expect(put.path).toBe('/v1/platform/concert-templates/t1/zones');
    expect(put.body).toEqual({
      stage: { shape: 'RECT', x: 1, y: 2, width: 30, height: 5 },
      zones: [
        {
          zoneCode: 'A',
          name: 'Khu a',
          kind: 'SEATED',
          rowCount: 4,
          seatsPerRow: 10,
          capacity: null,
          sortOrder: 0,
          suggestedPriceVnd: 500_000,
          layoutShape: 'GRID',
          originX: 10,
          originY: 20,
          rotationDeg: 15,
          innerRadius: null,
          startAngleDeg: null,
          endAngleDeg: null,
        },
      ],
    });
  });

  it('thêm khu mới đứng: nhãn "(mới)", gửi capacity và bỏ hàng/ghế, không kèm hình học', async () => {
    const user = userEvent.setup();
    const { calls } = await openEditor(user, detail(), (c) =>
      c.method === 'PUT' ? { status: 200, body: detail() } : null,
    );
    await user.click(screen.getByRole('button', { name: /Thêm khu/ }));
    const fieldset = screen.getByRole('group', { name: /Khu 2 \(mới\)/ });
    await user.type(within(fieldset).getByLabelText(/Mã khu/), 'SAN');
    await user.type(within(fieldset).getByLabelText(/Tên khu/), 'Sân đứng');
    await user.selectOptions(within(fieldset).getByLabelText('Loại'), 'STANDING');
    await user.type(within(fieldset).getByLabelText(/Sức chứa/), '1500');
    await user.click(screen.getByRole('button', { name: 'Lưu bảng khu' }));

    await screen.findByText('Đã lưu bảng khu');
    const body = calls.find((c) => c.method === 'PUT')!.body as { zones: Array<Record<string, unknown>> };
    expect(body.zones[1]).toEqual({
      zoneCode: 'SAN',
      name: 'Sân đứng',
      kind: 'STANDING',
      rowCount: null,
      seatsPerRow: null,
      capacity: 1500,
      sortOrder: 1,
      suggestedPriceVnd: null,
      layoutShape: null,
      originX: null,
      originY: null,
      rotationDeg: null,
      innerRadius: null,
      startAngleDeg: null,
      endAngleDeg: null,
    });
  });

  it('bỏ hết khu rồi lưu: báo lỗi, không gọi API', async () => {
    const user = userEvent.setup();
    const { calls } = await openEditor(user);
    await user.click(screen.getByRole('button', { name: /Bỏ khu này/ }));
    await user.click(screen.getByRole('button', { name: 'Lưu bảng khu' }));
    expect(errorText()).toMatch(/ít nhất một khu/);
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  it('mã khu trùng nhau bị chặn trước khi gửi', async () => {
    const user = userEvent.setup();
    const { calls } = await openEditor(user, detail({ zones: [zone('a'), zone('b', { sortOrder: 1 })] }));
    const codes = screen.getAllByLabelText(/Mã khu/);
    await user.clear(codes[1]!);
    await user.type(codes[1]!, 'A');
    await user.click(screen.getByRole('button', { name: 'Lưu bảng khu' }));
    expect(errorText()).toBe('Mã khu A bị trùng.');
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  it('thiếu mã hoặc tên: báo cần cả hai', async () => {
    const user = userEvent.setup();
    await openEditor(user);
    await user.clear(screen.getByLabelText(/Tên khu/));
    await user.click(screen.getByRole('button', { name: 'Lưu bảng khu' }));
    expect(errorText()).toMatch(/cần cả mã và tên/);
  });

  it('khu ngồi thiếu số hàng/ghế và khu đứng thiếu sức chứa đều bị chặn', async () => {
    const user = userEvent.setup();
    await openEditor(user);
    await user.clear(screen.getByLabelText(/Số hàng/));
    await user.click(screen.getByRole('button', { name: 'Lưu bảng khu' }));
    expect(errorText()).toMatch(/khu ghế ngồi cần số hàng và số ghế mỗi hàng/);

    await user.selectOptions(screen.getByLabelText('Loại'), 'STANDING');
    await user.click(screen.getByRole('button', { name: 'Lưu bảng khu' }));
    expect(errorText()).toMatch(/khu đứng cần sức chứa/);
  });

  it('số không nguyên dương (0, âm, thập phân) bị từ chối', async () => {
    const user = userEvent.setup();
    const { calls } = await openEditor(user);
    const rows = screen.getByLabelText(/Số hàng/);
    for (const bad of ['0', '-3', '2.5']) {
      fireEvent.change(rows, { target: { value: bad } });
      await user.click(screen.getByRole('button', { name: 'Lưu bảng khu' }));
      expect(errorText()).toMatch(/phải là số nguyên dương/);
    }
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  it('giá gợi ý âm hoặc thập phân bị từ chối; để trống thì gửi null', async () => {
    const user = userEvent.setup();
    const { calls } = await openEditor(user, detail(), (c) =>
      c.method === 'PUT' ? { status: 200, body: detail() } : null,
    );
    const price = screen.getByLabelText(/Giá gợi ý/);
    await user.clear(price);
    await user.type(price, '-1');
    await user.click(screen.getByRole('button', { name: 'Lưu bảng khu' }));
    expect(errorText()).toMatch(/giá gợi ý phải là số nguyên không âm/);

    await user.clear(price);
    await user.click(screen.getByRole('button', { name: 'Lưu bảng khu' }));
    await screen.findByText('Đã lưu bảng khu');
    const body = calls.find((c) => c.method === 'PUT')!.body as { zones: Array<{ suggestedPriceVnd: unknown }> };
    expect(body.zones[0]!.suggestedPriceVnd).toBeNull();
  });

  it('Huỷ thoát chế độ sửa mà không gọi API', async () => {
    const user = userEvent.setup();
    const { calls } = await openEditor(user);
    await user.click(screen.getByRole('button', { name: 'Huỷ' }));
    expect(screen.getByRole('table', { name: 'Khu vực của khung' })).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  });
});
