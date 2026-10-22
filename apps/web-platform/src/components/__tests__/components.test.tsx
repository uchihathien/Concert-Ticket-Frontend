import type { Member } from '@nexaticket/ts-sdk';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { permissionsBody, renderWithApi, type FakeRoute } from '../../lib/__tests__/harness';
import { OrganizationBalancePanel } from '../OrganizationBalancePanel';
import { SuperAdminGate } from '../SuperAdminGate';
import { UserAccountDialog } from '../UserAccountDialog';

describe('SuperAdminGate — quyền hiển thị khu vực nền tảng', () => {
  const route =
    (status: number, body: unknown): FakeRoute =>
    () => ({ status, body });

  it('trong lúc chưa biết quyền thì hiện khung chờ, không lộ nội dung', () => {
    renderWithApi(
      <SuperAdminGate>
        <p>Nội dung quản trị</p>
      </SuperAdminGate>,
      () => ({ status: 200, body: permissionsBody({}) }),
    );
    expect(screen.queryByText('Nội dung quản trị')).not.toBeInTheDocument();
    expect(screen.queryByText('Khu vực dành cho quản trị nền tảng')).not.toBeInTheDocument();
  });

  it('có PLATFORM_ORG_MANAGE thì hiện nội dung', async () => {
    renderWithApi(
      <SuperAdminGate>
        <p>Nội dung quản trị</p>
      </SuperAdminGate>,
      route(200, permissionsBody({ superAdmin: true, platformPermissions: ['PLATFORM_ORG_MANAGE'] })),
    );
    expect(await screen.findByText('Nội dung quản trị')).toBeInTheDocument();
  });

  it('người thường (có quyền tổ chức nhưng không có quyền nền tảng) thấy thông báo, không thấy nội dung', async () => {
    renderWithApi(
      <SuperAdminGate>
        <p>Nội dung quản trị</p>
      </SuperAdminGate>,
      route(200, permissionsBody({ organizations: { o1: ['EVENT_READ'] } })),
    );
    expect(await screen.findByText('Khu vực dành cho quản trị nền tảng')).toBeInTheDocument();
    expect(screen.getByText(/dùng cổng quản trị tổ chức/)).toBeInTheDocument();
    expect(screen.queryByText('Nội dung quản trị')).not.toBeInTheDocument();
  });

  it('cờ superAdmin một mình không đủ: phải có đúng quyền PLATFORM_ORG_MANAGE', async () => {
    renderWithApi(
      <SuperAdminGate>
        <p>Nội dung quản trị</p>
      </SuperAdminGate>,
      route(200, permissionsBody({ superAdmin: true, platformPermissions: ['PLATFORM_AUDIT_READ'] })),
    );
    expect(await screen.findByText('Khu vực dành cho quản trị nền tảng')).toBeInTheDocument();
  });

  it('gọi quyền lỗi thì hiện lỗi chứ KHÔNG bảo là thiếu quyền', async () => {
    renderWithApi(
      <SuperAdminGate>
        <p>Nội dung quản trị</p>
      </SuperAdminGate>,
      route(500, { code: 'INTERNAL' }),
    );
    expect(await screen.findByRole('button', { name: /thử lại/i })).toBeInTheDocument();
    expect(screen.queryByText('Khu vực dành cho quản trị nền tảng')).not.toBeInTheDocument();
    expect(screen.queryByText('Nội dung quản trị')).not.toBeInTheDocument();
  });
});

describe('OrganizationBalancePanel', () => {
  const BALANCE = {
    availableVnd: 1_500_000,
    heldVnd: 250_000,
    refundReserveVnd: 100_000,
    inTransitVnd: 0,
  };

  it('hiện bốn tài khoản tách riêng, mỗi số tiền đúng nhãn, và gọi đúng endpoint', async () => {
    const { calls } = renderWithApi(<OrganizationBalancePanel organizationId="org-1" />, () => ({
      status: 200,
      body: BALANCE,
    }));
    expect(await screen.findByText('Khả dụng')).toBeInTheDocument();

    const amountOf = (label: string) => {
      const term = screen.getByText(label);
      return within(term.parentElement as HTMLElement).getByLabelText(/đồng$/);
    };
    expect(amountOf('Khả dụng')).toHaveAccessibleName('1.500.000 đồng');
    expect(amountOf('Đang giữ')).toHaveAccessibleName('250.000 đồng');
    expect(amountOf('Dự phòng hoàn tiền')).toHaveAccessibleName('100.000 đồng');
    expect(amountOf('Đang chuyển')).toHaveAccessibleName('0 đồng');
    // Không cộng thành "tổng": cộng tiền đang giữ với tiền khả dụng ra con số không ai rút được.
    expect(screen.queryByText(/tổng/i)).not.toBeInTheDocument();
    expect(calls.map((c) => c.path)).toEqual(['/v1/platform/organizations/org-1/balance']);
  });

  it('lỗi thì hiện khối lỗi kèm thử lại, và KHÔNG vẽ bốn số 0', async () => {
    renderWithApi(<OrganizationBalancePanel organizationId="org-1" />, () => ({
      status: 503,
      body: { code: 'UNAVAILABLE' },
    }));
    expect(await screen.findByRole('button', { name: /thử lại/i })).toBeInTheDocument();
    expect(screen.queryByText('Khả dụng')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('0 đồng')).not.toBeInTheDocument();
  });

  it('404 (ledger-service chưa chạy) cũng hiện lỗi chứ không vẽ số dư', async () => {
    const { calls } = renderWithApi(<OrganizationBalancePanel organizationId="org-1" />, () => ({
      status: 404,
      body: { code: 'NOT_FOUND' },
    }));
    await waitFor(() => expect(calls).toHaveLength(1));
    await waitFor(() => expect(screen.queryByText('Khả dụng')).not.toBeInTheDocument());
    expect(screen.queryByText('Dự phòng hoàn tiền')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/đồng$/)).not.toBeInTheDocument();
  });

  it('bấm thử lại hỏi lại server và hiện số dư khi server đã hồi phục', async () => {
    let healthy = false;
    const { calls } = renderWithApi(<OrganizationBalancePanel organizationId="org-1" />, () =>
      healthy ? { status: 200, body: BALANCE } : { status: 503, body: { code: 'UNAVAILABLE' } },
    );
    const retry = await screen.findByRole('button', { name: /thử lại/i });
    healthy = true;
    await userEvent.click(retry);
    expect(await screen.findByText('Khả dụng')).toBeInTheDocument();
    expect(calls).toHaveLength(2);
  });
});

describe('UserAccountDialog', () => {
  const MEMBER = {
    userId: 'u-7',
    fullName: 'Nguyễn Văn A',
    email: 'a@example.com',
    role: 'ORG_ADMIN',
  } as unknown as Member;

  function setup(member: Member = MEMBER, status = 204) {
    const onClose = vi.fn();
    const utils = renderWithApi(<UserAccountDialog member={member} onClose={onClose} />, () => ({
      status,
      body: status === 204 ? undefined : { code: 'FORBIDDEN' },
    }));
    return { onClose, ...utils };
  }

  it('tiêu đề dùng họ tên; thiếu họ tên thì dùng email, thiếu cả hai thì dùng userId', () => {
    const first = setup();
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Tài khoản của Nguyễn Văn A');
    first.unmount();

    const second = setup({ ...MEMBER, fullName: '' } as Member);
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Tài khoản của a@example.com');
    second.unmount();

    setup({ ...MEMBER, fullName: '', email: '' } as Member);
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Tài khoản của u-7');
  });

  it('nút Vô hiệu hoá bị khoá cho tới khi có lý do; chỉ khoảng trắng không tính', async () => {
    setup();
    const disable = screen.getByRole('button', { name: 'Vô hiệu hoá' });
    expect(disable).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/Lý do vô hiệu hoá/), '   ');
    expect(disable).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/Lý do vô hiệu hoá/), ' Gian lận ');
    expect(disable).toBeEnabled();
  });

  it('vô hiệu hoá: gửi lý do đã cắt khoảng trắng, đóng hộp thoại khi thành công', async () => {
    const { onClose, calls } = setup();
    await userEvent.type(screen.getByLabelText(/Lý do vô hiệu hoá/), '  Gian lận  ');
    await userEvent.click(screen.getByRole('button', { name: 'Vô hiệu hoá' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(calls).toEqual([
      { method: 'POST', path: '/v1/platform/users/u-7/disable', body: { reason: 'Gian lận' } },
    ]);
    expect(await screen.findByText('Đã vô hiệu hoá tài khoản')).toBeInTheDocument();
  });

  it('khôi phục không cần lý do', async () => {
    const { onClose, calls } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Khôi phục' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(calls[0]).toMatchObject({ method: 'POST', path: '/v1/platform/users/u-7/enable' });
    expect(await screen.findByText('Đã khôi phục tài khoản')).toBeInTheDocument();
  });

  it('server từ chối (403) thì giữ hộp thoại mở và không báo thành công', async () => {
    const { onClose } = setup(MEMBER, 403);
    await userEvent.type(screen.getByLabelText(/Lý do vô hiệu hoá/), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Vô hiệu hoá' }));

    await waitFor(() => expect(screen.queryByText('Đã vô hiệu hoá tài khoản')).not.toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('nút Đóng gọi onClose', async () => {
    const { onClose } = setup();
    // Hộp thoại có hai nút tên "Đóng": dấu × ở tiêu đề và nút ở chân; cả hai đều phải đóng được.
    const buttons = screen.getAllByRole('button', { name: 'Đóng' });
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    await userEvent.click(buttons[buttons.length - 1]!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
