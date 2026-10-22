'use client';

import type { StaffCredentials } from '@nexaticket/ts-sdk';
import { Button, Modal, QrCode } from '@nexaticket/ui';
import { Printer } from 'lucide-react';

/**
 * Phiếu nhân viên: tên, tên đăng nhập, PIN, sự kiện được gán và mã QR đăng nhập.
 *
 * Đây là lần DUY NHẤT PIN hiện ra — backend không lưu nó ở dạng đọc lại được. Đóng hộp này mà chưa
 * in hay chép lại thì chỉ còn cách cấp PIN mới.
 *
 * Mã QR chứa cả PIN (`nexaticket-staff://login?u=…&p=…`), nên phiếu in ra là chìa khoá: ai cầm phiếu
 * là đăng nhập được. Mất phiếu thì "Cấp lại PIN" — PIN cũ hết dùng và mọi phiên cũ bị đóng.
 */
export function StaffCardModal({
  credentials,
  organizationName,
  eventTitles,
  onClose,
}: {
  credentials: StaffCredentials | null;
  organizationName: string;
  eventTitles: Map<string, string>;
  onClose: () => void;
}) {
  return (
    <Modal
      open={credentials !== null}
      onClose={onClose}
      title="Phiếu nhân viên soát vé"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Đã lưu, đóng
          </Button>
          <Button onClick={() => window.print()}>
            <Printer aria-hidden="true" className="size-4" /> In phiếu
          </Button>
        </>
      }
    >
      {credentials ? (
        <div className="grid gap-4">
          <p className="m-0 rounded-nt border border-warn bg-warn/10 px-3 py-2 text-[13px] text-warn-text">
            Mã PIN chỉ hiện <strong>một lần</strong>. Hãy in phiếu hoặc chép lại trước khi đóng — sau đó chỉ
            có thể cấp PIN mới.
          </p>
          <div className="print-only-area grid justify-items-center gap-3 rounded-nt border border-border p-5 text-center">
            <div className="text-[11px] font-bold tracking-[0.18em]">NEXATICKET STAFF · {organizationName}</div>
            <div className="text-lg font-semibold">{credentials.fullName}</div>
            <div className="rounded-nt bg-white p-2">
              <QrCode value={credentials.loginUri} size={180} label="Mã QR đăng nhập ứng dụng NexaTicket Staff" />
            </div>
            <div className="grid gap-1">
              <div className="text-[13px] text-muted">Tên đăng nhập</div>
              <div className="font-mono text-xl font-semibold">{credentials.username}</div>
            </div>
            <div className="grid gap-1">
              <div className="text-[13px] text-muted">Mã PIN</div>
              <div className="font-mono text-3xl font-bold tracking-[0.3em]">{credentials.pin}</div>
            </div>
            <div className="grid gap-0.5 text-[13px]">
              <div className="text-muted">Sự kiện được soát</div>
              {credentials.eventIds.length === 0 ? (
                <div>Chưa gán sự kiện nào</div>
              ) : (
                credentials.eventIds.map((id) => <div key={id}>{eventTitles.get(id) ?? 'Sự kiện'}</div>)
              )}
            </div>
            <p className="m-0 max-w-xs text-[12px] text-muted">
              Mở ứng dụng NexaTicket Staff, bấm “Quét mã QR nhân viên” và đưa phiếu vào khung hình. Giữ phiếu
              cẩn thận: ai cầm phiếu đều đăng nhập được.
            </p>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
