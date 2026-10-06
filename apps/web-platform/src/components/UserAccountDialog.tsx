'use client';

import { ApiError, type Member } from '@nexaticket/ts-sdk';
import { Button, Input, Modal, useToast } from '@nexaticket/ui';
import { useState } from 'react';
import { useUserLifecycle } from '@/lib/platform-users';

/**
 * Vô hiệu hoá hoặc khôi phục TÀI KHOẢN của một người — phạm vi toàn nền tảng, khác với "Gỡ khỏi tổ
 * chức" (chỉ phạm vi một tổ chức).
 *
 * API không cho biết tài khoản đang bị khoá hay không, nên hộp thoại đưa cả hai lệnh và nói rõ cả hai
 * đều an toàn khi bấm lại: backend coi lệnh trùng trạng thái là không làm gì.
 */
export function UserAccountDialog({ member, onClose }: { member: Member; onClose: () => void }) {
  const toast = useToast();
  const lifecycle = useUserLifecycle();
  const [reason, setReason] = useState('');
  const who = member.fullName || member.email || member.userId;
  const trimmed = reason.trim();

  const fail = (error: unknown) => toast.showError(error instanceof ApiError ? error : null);

  return (
    <Modal
      open
      dismissible={!lifecycle.isPending}
      onClose={onClose}
      title={`Tài khoản của ${who}`}
      footer={
        <>
          <Button variant="secondary" disabled={lifecycle.isPending} onClick={onClose}>
            Đóng
          </Button>
          <Button
            variant="secondary"
            loading={lifecycle.isPending && lifecycle.variables?.action === 'enable'}
            disabled={lifecycle.isPending}
            onClick={() =>
              lifecycle.mutate(
                { userId: member.userId, action: 'enable' },
                {
                  onSuccess: () => {
                    toast.show({ tone: 'success', message: 'Đã khôi phục tài khoản' });
                    onClose();
                  },
                  onError: fail,
                },
              )
            }
          >
            Khôi phục
          </Button>
          <Button
            variant="danger"
            loading={lifecycle.isPending && lifecycle.variables?.action === 'disable'}
            disabled={lifecycle.isPending || !trimmed}
            onClick={() =>
              lifecycle.mutate(
                { userId: member.userId, action: 'disable', reason: trimmed },
                {
                  onSuccess: () => {
                    toast.show({ tone: 'success', message: 'Đã vô hiệu hoá tài khoản' });
                    onClose();
                  },
                  onError: fail,
                },
              )
            }
          >
            Vô hiệu hoá
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <p className="m-0">
          <strong>Vô hiệu hoá</strong> chặn mọi request của tài khoản này tới NexaTicket ở{' '}
          <em>mọi</em> tổ chức và đăng xuất mọi thiết bị. Tài khoản Keycloak không bị đụng tới, vé
          và đơn đã mua vẫn giữ nguyên.
        </p>
        <p className="m-0 text-sm text-muted">
          Hệ thống không cho biết tài khoản đang bị khoá hay không. Bấm một lệnh khi tài khoản đã ở
          trạng thái đó thì không có gì thay đổi. Không tự vô hiệu hoá được tài khoản của chính bạn.
        </p>
        <Input
          label="Lý do vô hiệu hoá"
          required
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          hint="Bắt buộc khi vô hiệu hoá. Ghi vào nhật ký nền tảng."
        />
      </div>
    </Modal>
  );
}
