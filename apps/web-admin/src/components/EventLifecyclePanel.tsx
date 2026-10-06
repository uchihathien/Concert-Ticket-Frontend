'use client';

import { ApiError, useHasPermission, type AdminEventDetail } from '@nexaticket/ts-sdk';
import { Button, Modal, Panel, Section, formatNumber, useToast } from '@nexaticket/ui';
import { Ban, RefreshCw, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { useCancelEvent, useDeleteDraftEvent, useResyncInventory } from '@/lib/event-lifecycle';

type Pending = 'cancel' | 'delete' | null;

/**
 * Các thao tác vòng đời ít dùng của một sự kiện, gom ở cuối trang chi tiết.
 *
 * Mỗi nút chỉ hiện ở đúng trạng thái backend chấp nhận (xem `event-lifecycle.ts`), để người dùng
 * không bấm vào một nút rồi nhận `INVALID_EVENT_STATE`. Huỷ và xoá cần xác nhận trong hộp thoại
 * không đóng được bằng Esc — hai thao tác này không đảo ngược được.
 */
export function EventLifecyclePanel({
  organizationId,
  event,
}: {
  organizationId: string;
  event: AdminEventDetail;
}) {
  const toast = useToast();
  const router = useRouter();
  const canManage = useHasPermission('CATALOG_MANAGE', organizationId);

  const cancel = useCancelEvent(organizationId, event.id);
  const remove = useDeleteDraftEvent(organizationId, event.id);
  const resync = useResyncInventory(organizationId, event.id);

  const [pending, setPending] = useState<Pending>(null);

  const fail = (error: unknown) => toast.showError(error instanceof ApiError ? error : null);

  const canResync = event.status === 'PUBLISHED';
  const canCancel = event.status !== 'CANCELLED';
  const canDelete = event.status === 'DRAFT';

  if (!canManage || (!canResync && !canCancel && !canDelete)) return null;

  const runResync = () =>
    resync.mutate(undefined, {
      onSuccess: (result) =>
        toast.show({
          tone: 'success',
          message: `Đã gửi lại sơ đồ của ${formatNumber(result.sessions)} suất diễn sang kho vé.`,
        }),
      onError: fail,
    });

  const runConfirmed = () => {
    if (pending === 'cancel') {
      cancel.mutate(undefined, {
        onSuccess: () => {
          setPending(null);
          toast.show({ tone: 'success', message: 'Đã huỷ sự kiện.' });
        },
        onError: fail,
      });
    } else if (pending === 'delete') {
      remove.mutate(undefined, {
        onSuccess: () => {
          setPending(null);
          toast.show({ tone: 'success', message: 'Đã xoá bản nháp.' });
          router.replace(`/?org=${organizationId}`);
        },
        onError: fail,
      });
    }
  };

  const busy = cancel.isPending || remove.isPending;

  return (
    <Section
      title="Thao tác khác"
      description="Những thao tác ít dùng. Huỷ và xoá không đảo ngược được."
    >
      <Panel>
        <ul className="m-0 grid list-none gap-4 p-0">
          {canResync ? (
            <LifecycleRow
              title="Đồng bộ lại sơ đồ chỗ"
              body="Dùng khi sơ đồ chỗ ở trang khách vẽ sai hoặc không hiện. Gửi lại vị trí ghế sang kho vé; không đổi giá, không đổi trạng thái bán."
              action={
                <Button variant="secondary" loading={resync.isPending} onClick={runResync}>
                  <RefreshCw size={16} aria-hidden="true" />
                  Đồng bộ lại
                </Button>
              }
            />
          ) : null}
          {canDelete ? (
            <LifecycleRow
              title="Xoá bản nháp"
              body="Chỉ áp dụng cho sự kiện chưa từng lên bán. Xoá hẳn sự kiện cùng suất diễn và giá vé."
              action={
                <Button variant="danger" onClick={() => setPending('delete')}>
                  <Trash2 size={16} aria-hidden="true" />
                  Xoá bản nháp
                </Button>
              }
            />
          ) : null}
          {canCancel ? (
            <LifecycleRow
              title="Huỷ sự kiện"
              body="Sự kiện biến khỏi trang công khai. Vé đã bán và bản ghi thanh toán vẫn giữ nguyên để hoàn tiền và đối soát; hoàn tiền xử lý ngoài hệ thống."
              action={
                <Button variant="danger" onClick={() => setPending('cancel')}>
                  <Ban size={16} aria-hidden="true" />
                  Huỷ sự kiện
                </Button>
              }
            />
          ) : null}
        </ul>
      </Panel>

      {pending ? (
        <Modal
          open
          dismissible={false}
          onClose={() => setPending(null)}
          title={pending === 'cancel' ? 'Huỷ sự kiện này?' : 'Xoá bản nháp này?'}
          footer={
            <>
              <Button variant="secondary" disabled={busy} onClick={() => setPending(null)}>
                Quay lại
              </Button>
              <Button variant="danger" loading={busy} onClick={runConfirmed}>
                {pending === 'cancel' ? 'Huỷ sự kiện' : 'Xoá vĩnh viễn'}
              </Button>
            </>
          }
        >
          <p className="m-0">
            {pending === 'cancel' ? (
              <>
                <strong>{event.title}</strong> sẽ chuyển sang <strong>Đã huỷ</strong>. Đây là trạng
                thái cuối: không xuất bản lại được.
              </>
            ) : (
              <>
                <strong>{event.title}</strong> cùng mọi suất diễn và giá vé sẽ bị xoá hẳn và không
                khôi phục được.
              </>
            )}
          </p>
        </Modal>
      ) : null}
    </Section>
  );
}

function LifecycleRow({ title, body, action }: { title: string; body: string; action: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-[240px] flex-1">
        <p className="m-0 font-semibold">{title}</p>
        <p className="m-0 mt-1 text-sm text-muted">{body}</p>
      </div>
      {action}
    </li>
  );
}
