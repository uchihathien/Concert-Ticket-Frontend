import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { permissionsBody, renderWithApi, type FakeCall } from '../../../lib/__tests__/harness';
import PlatformAuditPage from '../audit/page';

function entry(n: number, extra: Record<string, unknown> = {}) {
  return {
    id: `log-${n}`,
    actorUserId: 'aaaaaaaa-1111-2222-3333-444444444444',
    organizationId: 'bbbbbbbb-1111-2222-3333-444444444444',
    action: 'MEMBER_ROLE_CHANGED',
    entityType: 'MEMBERSHIP',
    entityId: 'cccccccc-1111-2222-3333-444444444444',
    beforeState: { role: 'ORG_ADMIN' },
    afterState: { role: 'EVENT_MANAGER' },
    correlationId: null,
    createdAt: '2026-10-20T03:00:00Z',
    ...extra,
  };
}

function routeWith(options: { permissions?: string[]; logs?: unknown[] | ((call: FakeCall) => unknown[]) }) {
  return (call: FakeCall) => {
    if (call.path === '/v1/me/permissions') {
      return {
        status: 200,
        body: permissionsBody({
          superAdmin: true,
          platformPermissions: options.permissions ?? ['PLATFORM_AUDIT_READ'],
        }),
      };
    }
    if (call.path.startsWith('/v1/platform/audit-logs')) {
      const logs = typeof options.logs === 'function' ? options.logs(call) : (options.logs ?? []);
      return { status: 200, body: logs };
    }
    return { status: 404, body: { code: 'NOT_FOUND' } };
  };
}

const auditCalls = (calls: FakeCall[]) =>
  calls.filter((c) => c.path.startsWith('/v1/platform/audit-logs')).map((c) => new URL(c.path, 'http://x'));

describe('Nhật ký nền tảng — quyền xem', () => {
  it('thiếu PLATFORM_AUDIT_READ: hiện thông báo thiếu quyền và KHÔNG gọi API nhật ký', async () => {
    const { calls } = renderWithApi(
      <PlatformAuditPage />,
      routeWith({ permissions: ['PLATFORM_ORG_MANAGE'] }),
    );
    expect(await screen.findByText('Bạn không có quyền xem nhật ký nền tảng')).toBeInTheDocument();
    expect(screen.getByText(/PLATFORM_AUDIT_READ/)).toBeInTheDocument();
    expect(auditCalls(calls)).toHaveLength(0);
  });

  it('superadmin có quyền nền tảng đúng mới thấy bảng nhật ký', async () => {
    const { calls } = renderWithApi(<PlatformAuditPage />, routeWith({ logs: [entry(1)] }));
    expect(await screen.findByRole('table', { name: 'Nhật ký kiểm toán nền tảng' })).toBeInTheDocument();
    await waitFor(() => expect(auditCalls(calls)).toHaveLength(1));
  });
});

describe('Nhật ký nền tảng — hiển thị dòng', () => {
  it('hiện nhãn hành động tiếng Việt, rút gọn id còn 8 ký tự, liên kết sang tổ chức', async () => {
    renderWithApi(<PlatformAuditPage />, routeWith({ logs: [entry(1)] }));
    const table = await screen.findByRole('table');
    const row = (await within(table).findByText('Đổi vai trò')).closest('tr')!;

    expect(within(row).getByText('aaaaaaaa')).toBeInTheDocument();
    const orgLink = within(row).getByRole('link', { name: 'bbbbbbbb' });
    expect(orgLink).toHaveAttribute('href', '/organizations/bbbbbbbb-1111-2222-3333-444444444444');
    expect(within(row).getByText('MEMBERSHIP · cccccccc')).toBeInTheDocument();
  });

  it('thao tác không thuộc tổ chức ghi "Nền tảng", không có người thực hiện ghi "Hệ thống"', async () => {
    renderWithApi(
      <PlatformAuditPage />,
      routeWith({
        logs: [entry(1, { organizationId: null, actorUserId: null, entityId: null, action: 'USER_DISABLED' })],
      }),
    );
    const table = await screen.findByRole('table');
    const row = (await within(table).findByText('Nền tảng')).closest('tr')!;
    expect(within(row).getByText('Hệ thống')).toBeInTheDocument();
    expect(within(row).queryByRole('link')).not.toBeInTheDocument();
    // Không có entityId thì không in dấu "·" thừa.
    expect(within(row).getByText('MEMBERSHIP')).toBeInTheDocument();
  });

  it('hành động lạ chưa có nhãn thì hiện nguyên mã thay vì để trống', async () => {
    renderWithApi(<PlatformAuditPage />, routeWith({ logs: [entry(1, { action: 'HANH_DONG_MOI' })] }));
    expect(await screen.findByText('HANH_DONG_MOI')).toBeInTheDocument();
  });

  it('chưa có dòng nào và chưa lọc: báo "Chưa có thao tác nào được ghi"', async () => {
    renderWithApi(<PlatformAuditPage />, routeWith({ logs: [] }));
    expect(await screen.findByText('Chưa có thao tác nào được ghi')).toBeInTheDocument();
  });
});

describe('Nhật ký nền tảng — bộ lọc gửi lên server', () => {
  it('chọn hành động gửi ?action= và quay về trang đầu; thông báo rỗng đổi theo bộ lọc', async () => {
    const user = userEvent.setup();
    const { calls } = renderWithApi(
      <PlatformAuditPage />,
      routeWith({
        logs: (call) =>
          new URL(call.path, 'http://x').searchParams.get('action')
            ? []
            : Array.from({ length: 50 }, (_, i) => entry(i)),
      }),
    );
    await screen.findByRole('table');
    await screen.findAllByText('Đổi vai trò');

    // Sang trang 2 (offset 50) rồi đổi bộ lọc: offset phải về 0.
    await user.click(screen.getByRole('button', { name: 'Trang sau' }));
    await waitFor(() => expect(auditCalls(calls).at(-1)!.searchParams.get('offset')).toBe('50'));

    await user.selectOptions(screen.getByLabelText('Hành động'), 'MEMBER_REMOVED');
    await waitFor(() => {
      const last = auditCalls(calls).at(-1)!;
      expect(last.searchParams.get('action')).toBe('MEMBER_REMOVED');
      expect(last.searchParams.get('offset')).toBe('0');
    });
    expect(await screen.findByText('Không có thao tác nào khớp bộ lọc')).toBeInTheDocument();
  });

  it.each([
    ['today', 1],
    ['7d', 7],
    ['30d', 30],
  ])('khoảng "%s" gửi from/to cách nhau %i ngày, tròn nửa đêm giờ Việt Nam', async (range, days) => {
    const user = userEvent.setup();
    const { calls } = renderWithApi(<PlatformAuditPage />, routeWith({ logs: [] }));
    await screen.findByRole('table');
    expect(auditCalls(calls)[0]!.searchParams.has('from')).toBe(false);

    await user.selectOptions(screen.getByLabelText('Thời gian'), range);
    await waitFor(() => expect(auditCalls(calls).at(-1)!.searchParams.has('from')).toBe(true));
    const params = auditCalls(calls).at(-1)!.searchParams;
    const from = new Date(params.get('from')!);
    const to = new Date(params.get('to')!);
    expect((to.getTime() - from.getTime()) / 86_400_000).toBe(days);
    // 00:00 giờ VN = 17:00 UTC của ngày hôm trước.
    expect(to.getUTCHours()).toBe(17);
    expect(to.getUTCMinutes()).toBe(0);
  });

  it('chọn lại "Mọi lúc" quay về dữ liệu không giới hạn thời gian (khoá cache không dính from/to)', async () => {
    const user = userEvent.setup();
    renderWithApi(
      <PlatformAuditPage />,
      routeWith({
        logs: (call) =>
          new URL(call.path, 'http://x').searchParams.has('from')
            ? [entry(1, { action: 'MEMBER_REMOVED' })]
            : [entry(2, { action: 'MEMBER_INVITED' })],
      }),
    );
    // Nhãn hành động cũng nằm trong ô chọn "Hành động", nên chỉ tìm trong bảng.
    const inTable = () => within(screen.getByRole('table'));
    await waitFor(() => expect(inTable().getByText('Mời thành viên')).toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText('Thời gian'), '7d');
    await waitFor(() => expect(inTable().getByText('Gỡ thành viên')).toBeInTheDocument());
    expect(inTable().queryByText('Mời thành viên')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Thời gian'), '');
    await waitFor(() => expect(inTable().getByText('Mời thành viên')).toBeInTheDocument());
    expect(inTable().queryByText('Gỡ thành viên')).not.toBeInTheDocument();
  });

  it('phân trang: trang đầu khoá "Trang trước"; ít hơn 50 dòng thì khoá "Trang sau"', async () => {
    renderWithApi(<PlatformAuditPage />, routeWith({ logs: [entry(1)] }));
    await screen.findByRole('table');
    expect(screen.getByRole('button', { name: 'Trang trước' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Trang sau' })).toBeDisabled();
  });
});
