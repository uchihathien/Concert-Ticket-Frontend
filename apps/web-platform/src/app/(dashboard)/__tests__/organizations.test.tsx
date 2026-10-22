import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { permissionsBody, renderWithApi, type FakeCall } from '../../../lib/__tests__/harness';

// Bộ lọc của trang sống trên URL: giả `next/navigation` với một URLSearchParams điều khiển được.
const nav = vi.hoisted(() => ({
  params: new URLSearchParams(),
  replace: vi.fn(),
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, push: nav.push }),
  useSearchParams: () => nav.params,
}));

import OrganizationsPage from '../organizations/page';

type Org = { id: string; slug: string; name: string; status: 'ACTIVE' | 'SUSPENDED'; memberCount: number };

const ORGS: Org[] = [
  { id: 'id-song', slug: 'song-live', name: 'Sóng Live', status: 'ACTIVE', memberCount: 8 },
  { id: 'id-bien', slug: 'bien-dem', name: 'Biển Đêm', status: 'SUSPENDED', memberCount: 3 },
  { id: 'id-dong', slug: 'dong-nhac', name: 'Đông Nhạc', status: 'ACTIVE', memberCount: 0 },
  { id: 'id-an', slug: 'an-nhien', name: 'An Nhiên', status: 'ACTIVE', memberCount: 5 },
];

function routeFor(options: { canManage?: boolean; orgs?: Org[]; extra?: (call: FakeCall) => ReturnType<typeof Object> | null } = {}) {
  return (call: FakeCall) => {
    const extra = options.extra?.(call);
    if (extra) return extra as { status: number; body?: unknown };
    if (call.path === '/v1/me/permissions') {
      return {
        status: 200,
        body: permissionsBody({
          superAdmin: true,
          platformPermissions: options.canManage === false ? [] : ['PLATFORM_ORG_MANAGE'],
        }),
      };
    }
    if (call.path.startsWith('/v1/platform/organizations?')) {
      return { status: 200, body: options.orgs ?? ORGS };
    }
    return { status: 404, body: { code: 'NOT_FOUND' } };
  };
}

/** Tên tổ chức theo thứ tự các dòng hiện ra trong bảng. */
async function listedNames() {
  const table = await screen.findByRole('table', { name: 'Danh sách tổ chức' });
  await waitFor(() => expect(within(table).queryByRole('status')).not.toBeInTheDocument());
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).queryAllByRole('cell')[0]?.querySelector('span.font-medium')?.textContent)
    .filter(Boolean);
}

beforeEach(() => {
  nav.params = new URLSearchParams();
  nav.replace.mockReset();
  nav.push.mockReset();
});

describe('Trang Tổ chức — danh sách, lọc, sắp xếp', () => {
  it('mặc định sắp theo tên (theo thứ tự chữ cái tiếng Việt) và đếm số liệu đầu trang', async () => {
    renderWithApi(<OrganizationsPage />, routeFor());
    await waitFor(async () =>
      expect(await listedNames()).toEqual(['An Nhiên', 'Biển Đêm', 'Đông Nhạc', 'Sóng Live']),
    );
    expect(screen.getByText('4 tổ chức đã tải.')).toBeInTheDocument();

    const statOf = (label: string) => screen.getAllByText(label)[0]!.parentElement!;
    expect(within(statOf('Đang hoạt động')).getByText('3')).toBeInTheDocument();
    expect(within(statOf('Đang khoá')).getByText('1')).toBeInTheDocument();
    expect(within(statOf('Tổng thành viên')).getByText('16')).toBeInTheDocument();
  });

  it('dòng 0 thành viên hiện nhãn "Chưa có" thay vì số 0', async () => {
    renderWithApi(<OrganizationsPage />, routeFor());
    const row = (await screen.findByText('Đông Nhạc')).closest('tr')!;
    expect(within(row).getByText('Chưa có')).toBeInTheDocument();
  });

  it('lọc trạng thái trên URL: SUSPENDED chỉ còn tổ chức đang khoá', async () => {
    nav.params = new URLSearchParams('status=SUSPENDED');
    renderWithApi(<OrganizationsPage />, routeFor());
    await waitFor(async () => expect(await listedNames()).toEqual(['Biển Đêm']));
    expect(screen.getByText('Hiện 1 trong 4 tổ chức đã tải.')).toBeInTheDocument();
  });

  it.each([
    ['none', ['Đông Nhạc']],
    ['small', ['An Nhiên', 'Biển Đêm']],
    ['large', ['Sóng Live']],
  ])('lọc quy mô %s', async (size, expected) => {
    nav.params = new URLSearchParams(`size=${size}`);
    renderWithApi(<OrganizationsPage />, routeFor());
    await waitFor(async () => expect(await listedNames()).toEqual(expected));
  });

  it('giá trị lạ trên URL rơi về "không lọc" chứ không ra bảng trống', async () => {
    nav.params = new URLSearchParams('status=BAY_BA&size=khong-ton-tai&sort=xxx');
    renderWithApi(<OrganizationsPage />, routeFor());
    await waitFor(async () => expect(await listedNames()).toHaveLength(4));
  });

  it('tìm không dấu theo tên, đường dẫn hoặc mã; không khớp thì báo và cho xoá bộ lọc', async () => {
    const user = userEvent.setup();
    renderWithApi(<OrganizationsPage />, routeFor());
    await screen.findByText('Sóng Live');

    await user.type(screen.getByLabelText('Tìm tổ chức'), 'bien dem');
    await waitFor(async () => expect(await listedNames()).toEqual(['Biển Đêm']));

    await user.clear(screen.getByLabelText('Tìm tổ chức'));
    await user.type(screen.getByLabelText('Tìm tổ chức'), 'id-an');
    await waitFor(async () => expect(await listedNames()).toEqual(['An Nhiên']));

    await user.clear(screen.getByLabelText('Tìm tổ chức'));
    await user.type(screen.getByLabelText('Tìm tổ chức'), 'khong co');
    expect(await screen.findByText('Không tổ chức nào khớp bộ lọc')).toBeInTheDocument();
  });

  it('sắp theo thành viên giảm dần và theo trạng thái (đang khoá lên đầu)', async () => {
    nav.params = new URLSearchParams('sort=members&desc=1');
    const first = renderWithApi(<OrganizationsPage />, routeFor());
    await waitFor(async () =>
      expect(await listedNames()).toEqual(['Sóng Live', 'An Nhiên', 'Biển Đêm', 'Đông Nhạc']),
    );
    first.unmount();

    nav.params = new URLSearchParams('sort=status');
    renderWithApi(<OrganizationsPage />, routeFor());
    await waitFor(async () =>
      expect((await listedNames())[0]).toBe('Biển Đêm'),
    );
  });

  it('bấm tiêu đề cột đang sắp thì đảo chiều, cột khác thì về chiều xuôi', async () => {
    const user = userEvent.setup();
    nav.params = new URLSearchParams('sort=members');
    renderWithApi(<OrganizationsPage />, routeFor());
    await screen.findByText('Sóng Live');

    await user.click(screen.getByRole('button', { name: /Thành viên/ }));
    expect(nav.replace).toHaveBeenLastCalledWith('/organizations?sort=members&desc=1', { scroll: false });

    nav.replace.mockClear();
    await user.click(screen.getByRole('button', { name: /Trạng thái/ }));
    expect(nav.replace).toHaveBeenLastCalledWith('/organizations?sort=status', { scroll: false });
  });

  it('đổi bộ lọc trạng thái ghi URL và xoá chỉ số cửa sổ (win)', async () => {
    const user = userEvent.setup();
    nav.params = new URLSearchParams('win=2');
    renderWithApi(<OrganizationsPage />, routeFor());
    await screen.findByText('Sóng Live');

    await user.selectOptions(screen.getByLabelText('Trạng thái'), 'ACTIVE');
    expect(nav.replace).toHaveBeenLastCalledWith('/organizations?status=ACTIVE', { scroll: false });
  });

  it('cửa sổ thứ n gọi API với offset = n × 200', async () => {
    nav.params = new URLSearchParams('win=2');
    const { calls } = renderWithApi(<OrganizationsPage />, routeFor());
    await screen.findByText('Sóng Live');
    expect(calls.some((c) => c.path === '/v1/platform/organizations?limit=200&offset=400')).toBe(true);
  });

  it('API lỗi hiện khối lỗi, không hiện bảng trống', async () => {
    renderWithApi(
      <OrganizationsPage />,
      routeFor({ extra: (c) => (c.path.startsWith('/v1/platform/organizations?') ? ({ status: 503, body: { code: 'UNAVAILABLE' } } as never) : null) }),
    );
    expect(await screen.findByRole('button', { name: /thử lại/i })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('Trang Tổ chức — quyền thao tác', () => {
  it('có PLATFORM_ORG_MANAGE: thấy nút Tạo tổ chức và Khoá/Mở khoá đúng theo trạng thái', async () => {
    renderWithApi(<OrganizationsPage />, routeFor({ canManage: true }));
    expect(await screen.findByRole('button', { name: 'Tạo tổ chức' })).toBeInTheDocument();
    const active = (await screen.findByText('Sóng Live')).closest('tr')!;
    const suspended = screen.getByText('Biển Đêm').closest('tr')!;
    expect(within(active).getByRole('button', { name: 'Khoá' })).toBeInTheDocument();
    expect(within(suspended).getByRole('button', { name: 'Mở khoá' })).toBeInTheDocument();
  });

  it('không có quyền quản lý: ẩn Tạo tổ chức và mọi nút Khoá/Mở khoá, vẫn có Chi tiết', async () => {
    renderWithApi(<OrganizationsPage />, routeFor({ canManage: false }));
    const row = (await screen.findByText('Sóng Live')).closest('tr')!;
    await waitFor(() => expect(within(row).getByRole('link', { name: 'Chi tiết' })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Tạo tổ chức' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^(Khoá|Mở khoá)$/ })).not.toBeInTheDocument();
  });

  it('khoá tổ chức: hỏi xác nhận, gọi POST .../suspend rồi báo thành công', async () => {
    const user = userEvent.setup();
    const { calls } = renderWithApi(
      <OrganizationsPage />,
      routeFor({
        extra: (c) =>
          c.method === 'POST' && c.path === '/v1/platform/organizations/id-song/suspend'
            ? ({ status: 204 } as never)
            : null,
      }),
    );
    const row = (await screen.findByText('Sóng Live')).closest('tr')!;
    await user.click(await within(row).findByRole('button', { name: 'Khoá' }));

    const dialog = await screen.findByRole('dialog', { name: 'Khoá tổ chức?' });
    expect(within(dialog).getByText(/không.*dừng việc bán vé/)).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
    await user.click(within(dialog).getByRole('button', { name: 'Khoá tổ chức' }));

    expect(await screen.findByText('Đã khoá tổ chức')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST' && c.path.endsWith('/id-song/suspend'))).toBe(true);
  });

  it('mở khoá tổ chức đang khoá gọi POST .../activate', async () => {
    const user = userEvent.setup();
    const { calls } = renderWithApi(
      <OrganizationsPage />,
      routeFor({
        extra: (c) =>
          c.method === 'POST' && c.path === '/v1/platform/organizations/id-bien/activate'
            ? ({ status: 204 } as never)
            : null,
      }),
    );
    const row = (await screen.findByText('Biển Đêm')).closest('tr')!;
    await user.click(await within(row).findByRole('button', { name: 'Mở khoá' }));
    const dialog = await screen.findByRole('dialog', { name: 'Mở khoá tổ chức?' });
    await user.click(within(dialog).getByRole('button', { name: 'Mở khoá' }));

    expect(await screen.findByText('Đã mở khoá tổ chức')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST' && c.path.endsWith('/id-bien/activate'))).toBe(true);
  });

  it('bấm Khoá không kích hoạt điều hướng của cả dòng', async () => {
    const user = userEvent.setup();
    renderWithApi(<OrganizationsPage />, routeFor());
    const row = (await screen.findByText('Sóng Live')).closest('tr')!;
    await user.click(await within(row).findByRole('button', { name: 'Khoá' }));
    expect(nav.push).not.toHaveBeenCalled();

    await user.click(within(row).getByText('Sóng Live'));
    expect(nav.push).toHaveBeenCalledWith('/organizations/id-song');
  });

  it('tạo tổ chức: gửi tên/email đã cắt khoảng trắng, bỏ slug trống, rồi hiện mã lời mời một lần', async () => {
    const user = userEvent.setup();
    const { calls } = renderWithApi(
      <OrganizationsPage />,
      routeFor({
        extra: (c) =>
          c.method === 'POST' && c.path === '/v1/platform/organizations'
            ? ({
                status: 200,
                body: {
                  id: 'new-1',
                  name: 'Tổ chức Mới',
                  slug: 'to-chuc-moi',
                  ownerEmail: 'chu@example.com',
                  invitationToken: 'TOKEN-MOT-LAN',
                },
              } as never)
            : null,
      }),
    );
    await user.click(await screen.findByRole('button', { name: 'Tạo tổ chức' }));
    const dialog = await screen.findByRole('dialog', { name: 'Tạo tổ chức' });
    await user.type(within(dialog).getByLabelText(/Tên tổ chức/), '  Tổ chức Mới  ');
    await user.type(within(dialog).getByLabelText(/Email chủ sở hữu/), ' chu@example.com ');
    await user.click(within(dialog).getByRole('button', { name: 'Tạo' }));

    const done = await screen.findByRole('dialog', { name: 'Đã tạo tổ chức' });
    expect(within(done).getByText('chu@example.com')).toBeInTheDocument();
    expect(within(done).getByText('TOKEN-MOT-LAN')).toBeInTheDocument();
    const post = calls.find((c) => c.method === 'POST' && c.path === '/v1/platform/organizations')!;
    expect(post.body).toEqual({ name: 'Tổ chức Mới', ownerEmail: 'chu@example.com' });
  });
});
