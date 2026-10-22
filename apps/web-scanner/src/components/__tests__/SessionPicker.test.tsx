import { createApiClient } from '@nexaticket/ts-sdk';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Cùng cách với Scanner.test.tsx: fetch giả đưa thẳng vào ApiClient thật.
const net = vi.hoisted(() => ({
  calls: [] as Array<{ method: string; path: string }>,
  routes: {} as Record<string, () => { status: number; body?: unknown }>,
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: createApiClient({
    baseUrl: 'http://gateway.test',
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = init?.method ?? 'GET';
      net.calls.push({ method, path: url.pathname });
      const route = net.routes[`${method} ${url.pathname}`];
      if (!route) return new Response(JSON.stringify({ code: 'NOT_FOUND' }), { status: 404 });
      const { status, body } = route();
      return new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch,
  }),
}));

import { SessionPicker, formatSessionDate } from '../SessionPicker';

const ORG_A = { id: 'org-a', slug: 'a', name: 'Sóng Live', status: 'ACTIVE', memberCount: 3 };
const ORG_B = { id: 'org-b', slug: 'b', name: 'Biển Đêm', status: 'ACTIVE', memberCount: 1 };
const ORG_SUSPENDED = { id: 'org-s', slug: 's', name: 'Đã khoá', status: 'SUSPENDED', memberCount: 1 };

function session(id: string, eventId: string, title: string, startsAt: string, venue = 'Nhà hát Lớn') {
  return { eventSessionId: id, eventId, eventTitle: title, venueName: venue, startsAt, endsAt: null };
}

function permissions(organizations: Record<string, string[]>) {
  return { userId: 'u1', superAdmin: false, platformPermissions: [], organizations };
}

function setup(options: {
  organizations?: unknown[];
  permissions?: Record<string, string[]>;
  sessions?: Record<string, unknown[]>;
  invitations?: unknown[];
} = {}) {
  net.routes['GET /v1/me/organizations'] = () => ({
    status: 200,
    body: options.organizations ?? [ORG_A],
  });
  net.routes['GET /v1/me/permissions'] = () => ({
    status: 200,
    body: permissions(options.permissions ?? { 'org-a': ['CHECKIN_SCAN'] }),
  });
  net.routes['GET /v1/me/invitations'] = () => ({ status: 200, body: options.invitations ?? [] });
  for (const [orgId, list] of Object.entries(options.sessions ?? { 'org-a': [] })) {
    net.routes[`GET /v1/organizations/${orgId}/checkin-sessions`] = () => ({ status: 200, body: list });
  }
}

beforeEach(() => {
  net.calls.length = 0;
  net.routes = {};
});

afterEach(cleanup);

describe('SessionPicker — tải danh sách suất', () => {
  it('hiện trạng thái đang tải rồi gộp các suất cùng sự kiện vào một thẻ', async () => {
    setup({
      sessions: {
        'org-a': [
          session('s1', 'e1', 'Đêm nhạc Hạ', '2026-11-01T12:00:00Z'),
          session('s2', 'e1', 'Đêm nhạc Hạ', '2026-11-02T12:00:00Z'),
          session('s3', 'e2', 'Hài độc thoại', '2026-11-03T12:00:00Z'),
        ],
      },
    });
    render(<SessionPicker />);
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải danh sách suất');

    expect(await screen.findByRole('heading', { name: 'Đêm nhạc Hạ' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(2);
    expect(screen.getByText('2 suất — chọn suất bạn trực')).toBeInTheDocument();
    expect(screen.getByText('1 suất')).toBeInTheDocument();
  });

  it('mỗi suất là liên kết sang /scan với đủ tham số suất, tổ chức, tên, địa điểm, giờ', async () => {
    setup({ sessions: { 'org-a': [session('s 1', 'e1', 'Đêm nhạc Hạ', '2026-11-01T12:00:00Z')] } });
    render(<SessionPicker />);

    const link = await screen.findByRole('link', { name: /^Soát vé Đêm nhạc Hạ, suất / });
    const href = new URL(link.getAttribute('href')!, 'http://x');
    expect(href.pathname).toBe('/scan');
    expect(Object.fromEntries(href.searchParams)).toEqual({
      session: 's 1',
      org: 'org-a',
      title: 'Đêm nhạc Hạ',
      venue: 'Nhà hát Lớn',
      startsAt: '2026-11-01T12:00:00Z',
    });
  });

  it('chỉ lấy suất của tổ chức ACTIVE mà người dùng có quyền CHECKIN_SCAN', async () => {
    setup({
      organizations: [ORG_A, ORG_B, ORG_SUSPENDED],
      // org-b chỉ có quyền khác; org-s bị khoá dù có quyền.
      permissions: { 'org-a': ['CHECKIN_SCAN'], 'org-b': ['EVENT_READ'], 'org-s': ['CHECKIN_SCAN'] },
      sessions: {
        'org-a': [session('s1', 'e1', 'Của A', '2026-11-01T12:00:00Z')],
        'org-b': [session('s2', 'e2', 'Của B', '2026-11-01T12:00:00Z')],
        'org-s': [session('s3', 'e3', 'Của S', '2026-11-01T12:00:00Z')],
      },
    });
    render(<SessionPicker />);

    expect(await screen.findByRole('heading', { name: 'Của A' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Của B' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Của S' })).not.toBeInTheDocument();
    const listed = net.calls.filter((c) => c.path.endsWith('/checkin-sessions')).map((c) => c.path);
    expect(listed).toEqual(['/v1/organizations/org-a/checkin-sessions']);
  });

  it('suất của nhiều tổ chức được sắp theo giờ bắt đầu tăng dần', async () => {
    setup({
      organizations: [ORG_A, ORG_B],
      permissions: { 'org-a': ['CHECKIN_SCAN'], 'org-b': ['CHECKIN_SCAN'] },
      sessions: {
        'org-a': [session('s1', 'e1', 'Muộn', '2026-12-01T12:00:00Z')],
        'org-b': [session('s2', 'e2', 'Sớm', '2026-11-01T12:00:00Z')],
      },
    });
    render(<SessionPicker />);
    await screen.findByRole('heading', { name: 'Sớm' });
    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(titles).toEqual(['Sớm', 'Muộn']);
  });

  it('có quyền nhưng chưa có suất: nói rõ chưa có suất, kèm nút LÀM MỚI', async () => {
    setup({ sessions: { 'org-a': [] } });
    render(<SessionPicker />);
    expect(await screen.findByText('Chưa có suất đang diễn ra hoặc sắp diễn ra')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'LÀM MỚI' })).toBeInTheDocument();
  });

  it('không có tổ chức nào cấp quyền soát vé: báo thiếu quyền CHECKIN_SCAN, không phải "chưa có suất"', async () => {
    setup({ organizations: [ORG_A], permissions: { 'org-a': ['EVENT_READ'] }, sessions: {} });
    render(<SessionPicker />);
    expect(await screen.findByText('Chưa được cấp quyền soát vé')).toBeInTheDocument();
    expect(screen.getByText(/CHECKIN_SCAN/)).toBeInTheDocument();
    expect(screen.queryByText('Chưa có suất đang diễn ra hoặc sắp diễn ra')).not.toBeInTheDocument();
  });

  it('401 hiện thông báo hết phiên; lỗi khác hiện thông báo kết nối; TẢI LẠI gọi lại API', async () => {
    setup();
    net.routes['GET /v1/me/permissions'] = () => ({ status: 401, body: { code: 'UNAUTHENTICATED' } });
    const user = userEvent.setup();
    render(<SessionPicker />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Phiên đăng nhập đã hết hạn');

    net.routes['GET /v1/me/permissions'] = () => ({ status: 500, body: { code: 'BOOM' } });
    await user.click(screen.getByRole('button', { name: 'TẢI LẠI' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Không tải được danh sách suất diễn'),
    );

    setup({ sessions: { 'org-a': [session('s1', 'e1', 'Đã phục hồi', '2026-11-01T12:00:00Z')] } });
    await user.click(screen.getByRole('button', { name: 'TẢI LẠI' }));
    expect(await screen.findByRole('heading', { name: 'Đã phục hồi' })).toBeInTheDocument();
  });
});

describe('SessionPicker — tìm kiếm', () => {
  const LIST = {
    'org-a': [
      session('s1', 'e1', 'Đêm nhạc Hạ', '2026-10-15T13:00:00Z', 'Nhà hát Lớn'),
      session('s2', 'e1', 'Đêm nhạc Hạ', '2026-10-16T13:00:00Z', 'Nhà hát Lớn'),
      session('s3', 'e2', 'Hài độc thoại', '2026-10-15T13:00:00Z', 'Cung Việt Tiệp'),
    ],
  };

  it('gõ không dấu lọc ngay trên máy, hiện đếm khớp và không gọi thêm API', async () => {
    setup({ sessions: LIST });
    const user = userEvent.setup();
    render(<SessionPicker />);
    await screen.findByRole('heading', { name: 'Hài độc thoại' });
    const callsBefore = net.calls.length;

    await user.type(screen.getByLabelText('Tìm suất diễn'), 'dem nhac');
    expect(screen.queryByRole('heading', { name: 'Hài độc thoại' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Đêm nhạc Hạ' })).toBeInTheDocument();
    expect(screen.getByText('2 / 3 suất khớp · 1 sự kiện')).toBeInTheDocument();
    expect(net.calls).toHaveLength(callsBefore);
  });

  it('không khớp thì báo rõ từ khoá và XOÁ TÌM KIẾM đưa danh sách đầy đủ trở lại', async () => {
    setup({ sessions: LIST });
    const user = userEvent.setup();
    render(<SessionPicker />);
    await screen.findByRole('heading', { name: 'Hài độc thoại' });

    await user.type(screen.getByLabelText('Tìm suất diễn'), '  zzz ');
    expect(screen.getByText('Không có suất nào khớp “zzz”')).toBeInTheDocument();
    expect(screen.getByText('0 / 3 suất khớp · 0 sự kiện')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'XOÁ TÌM KIẾM' }));
    expect(screen.getByRole('heading', { name: 'Hài độc thoại' })).toBeInTheDocument();
    expect(screen.getByLabelText('Tìm suất diễn')).toHaveValue('');
    expect(screen.queryByText(/suất khớp/)).not.toBeInTheDocument();
  });

  it('nút × chỉ hiện khi đang tìm và xoá từ khoá', async () => {
    setup({ sessions: LIST });
    const user = userEvent.setup();
    render(<SessionPicker />);
    await screen.findByRole('heading', { name: 'Hài độc thoại' });
    expect(screen.queryByRole('button', { name: 'Xoá từ khoá tìm kiếm' })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Tìm suất diễn'), 'viet tiep');
    expect(screen.getByRole('heading', { name: 'Hài độc thoại' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Xoá từ khoá tìm kiếm' }));
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(2);
  });
});

describe('SessionPicker — lời mời đang chờ', () => {
  const INVITATION = {
    id: 'inv-1',
    organizationId: 'org-x',
    organizationName: 'Tổ chức Mới',
    role: 'CHECKIN_STAFF',
    expiresAt: '2026-12-01T00:00:00Z',
    expired: false,
  };

  it('hiện tên tổ chức, nhãn vai trò tiếng Việt; vai trò lạ thì hiện nguyên mã', async () => {
    setup({
      invitations: [INVITATION, { ...INVITATION, id: 'inv-2', role: 'ROLE_MOI_LA' }],
    });
    render(<SessionPicker />);
    expect(await screen.findByText('Vai trò: Nhân viên soát vé')).toBeInTheDocument();
    expect(screen.getByText('Vai trò: ROLE_MOI_LA')).toBeInTheDocument();
    expect(screen.getAllByText('Tổ chức Mới')).toHaveLength(2);
  });

  it('lời mời hết hạn: ghi "Đã hết hạn" và khoá nút chấp nhận', async () => {
    setup({ invitations: [{ ...INVITATION, expired: true }] });
    render(<SessionPicker />);
    expect(await screen.findByText('Đã hết hạn')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CHẤP NHẬN LỜI MỜI' })).toBeDisabled();
  });

  it('chấp nhận thành công: gọi đúng endpoint, báo thành công và tải lại danh sách', async () => {
    setup({ invitations: [INVITATION] });
    net.routes['POST /v1/me/invitations/inv-1/accept'] = () => ({
      status: 200,
      body: { ...ORG_B, id: 'org-x' },
    });
    const user = userEvent.setup();
    render(<SessionPicker />);
    await user.click(await screen.findByRole('button', { name: 'CHẤP NHẬN LỜI MỜI' }));

    expect(await screen.findByText(/Đã chấp nhận lời mời/)).toBeInTheDocument();
    expect(net.calls.some((c) => c.method === 'POST' && c.path === '/v1/me/invitations/inv-1/accept')).toBe(true);
    // Sau khi chấp nhận, danh sách tổ chức được hỏi lại (hai lần tổng cộng).
    await waitFor(() =>
      expect(net.calls.filter((c) => c.path === '/v1/me/organizations')).toHaveLength(2),
    );
  });

  it.each([
    ['EMAIL_MISMATCH', 'Lời mời được gửi tới email khác'],
    ['INVITATION_EXPIRED', 'Lời mời đã hết hạn. Hãy nhờ chủ tổ chức gửi lời mời mới.'],
    ['LOI_KHAC', 'Không thể chấp nhận lời mời lúc này'],
  ])('chấp nhận thất bại với mã %s hiện thông báo riêng', async (code, message) => {
    setup({ invitations: [INVITATION] });
    net.routes['POST /v1/me/invitations/inv-1/accept'] = () => ({ status: 409, body: { code } });
    const user = userEvent.setup();
    render(<SessionPicker />);
    await user.click(await screen.findByRole('button', { name: 'CHẤP NHẬN LỜI MỜI' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(message);
    // Thất bại thì danh sách vẫn còn nút để thử lại, không kẹt ở trạng thái đang tải.
    expect(within(document.body).getByRole('button', { name: 'CHẤP NHẬN LỜI MỜI' })).toBeEnabled();
  });
});

describe('formatSessionDate', () => {
  it('định dạng ngày giờ kiểu Việt Nam, có năm và giờ phút', () => {
    const text = formatSessionDate('2026-11-01T12:00:00Z');
    expect(text).toMatch(/2026/);
    expect(text).toMatch(/\d{1,2}:\d{2}/);
  });
});
