'use client';

import {
  useBulkTicketTypes,
  type AdminSession,
  type AdminZone,
  type CreateTicketTypeRequest,
} from '@nexaticket/ts-sdk';
import {
  Button,
  Input,
  Modal,
  foldText,
  formatDateTime,
  formatNumber,
  formatVnd,
} from '@nexaticket/ui';
import { useMemo, useState } from 'react';

export interface BulkPriceDialogProps {
  organizationId: string;
  eventId: string;
  session: AdminSession;
  /** Khu chưa có giá ở suất này. Khu đã có giá sửa từng cái ở bảng bên ngoài. */
  zones: AdminZone[];
  onClose: () => void;
  onDone: (priced: number) => void;
}

/**
 * Khai giá cho nhiều khu cùng lúc.
 *
 * <h3>Vì sao tồn tại</h3>
 *
 * Nhà thi đấu trong dữ liệu thật có <b>91 khu</b>. Đường một-khu-một-hộp-thoại nghĩa là mở hộp
 * thoại 91 lần, mỗi lần chọn khu trong một danh sách 91 mục. Đó không phải sự bất tiện — đó là lý
 * do một sân như vậy không dựng nổi bằng giao diện, và phải dựng bằng script.
 *
 * <h3>Lọc theo mã khu là thao tác chính, không phải tick từng ô</h3>
 *
 * Mã khu trong một khán phòng lớn luôn có cấu trúc: {@code LB-101…LB-159} là khán đài dưới,
 * {@code UB-301…UB-330} là khán đài trên. Gõ "LB" rồi bấm "Chọn hết" là hai thao tác cho ba mươi
 * khu. Ô tick vẫn còn cho những lần cần bỏ ra vài khu lẻ.
 *
 * <h3>Tên hạng vé: lấy theo tên khu, trừ khi người dùng muốn khác</h3>
 *
 * Mặc định mỗi khu thành một hạng vé mang đúng tên khu — đó là thứ khách nhìn thấy, và "Khán đài A
 * · 101" nói nhiều hơn "Hạng 2". Ai muốn gộp tên thì gõ một tên chung, và cả lô mang tên ấy.
 */
export function BulkPriceDialog({
  organizationId,
  eventId,
  session,
  zones,
  onClose,
  onDone,
}: BulkPriceDialogProps) {
  const bulk = useBulkTicketTypes(organizationId, eventId);

  const [query, setQuery] = useState('');
  const [price, setPrice] = useState('');
  const [sharedName, setSharedName] = useState('');
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failed, setFailed] = useState<Array<{ venueZoneId: string; message: string }>>([]);

  const matching = useMemo(() => {
    const needle = foldText(query.trim());
    if (needle === '') return zones;
    return zones.filter(
      (zone) => foldText(zone.zoneCode).includes(needle) || foldText(zone.name).includes(needle),
    );
  }, [zones, query]);

  // "Đang chọn" = khớp bộ lọc VÀ chưa bị bỏ ra. Giữ danh sách LOẠI TRỪ thay vì danh sách chọn, để
  // gõ lại bộ lọc không xoá mất những gì người dùng vừa cân nhắc.
  const selected = useMemo(
    () => matching.filter((zone) => !excluded.has(zone.id)),
    [matching, excluded],
  );

  const parsedPrice = Number(price);
  const priceValid = price.trim() !== '' && Number.isFinite(parsedPrice) && parsedPrice >= 0;
  const seatsOf = (zone: AdminZone) =>
    zone.kind === 'SEATED' ? zone.seatCount : (zone.capacity ?? 0);
  const totalSeats = selected.reduce((sum, zone) => sum + seatsOf(zone), 0);

  function toggle(zoneId: string) {
    setExcluded((current) => {
      const next = new Set(current);
      if (next.has(zoneId)) next.delete(zoneId);
      else next.add(zoneId);
      return next;
    });
  }

  async function apply() {
    if (!priceValid || selected.length === 0) return;
    setFailed([]);
    setProgress({ done: 0, total: selected.length });

    const lines: CreateTicketTypeRequest[] = selected.map((zone) => ({
      venueZoneId: zone.id,
      name: sharedName.trim() || zone.name,
      priceVnd: parsedPrice,
    }));

    const result = await bulk.mutateAsync({
      sessionId: session.id,
      lines,
      onProgress: (done, total) => setProgress({ done, total }),
    });

    setProgress(null);
    if (result.failed.length === 0) {
      onDone(lines.length);
      return;
    }
    // Còn khu hỏng thì KHÔNG đóng: đóng đi là giấu mất phần việc chưa xong, và người dùng chỉ phát
    // hiện ở bước publish khi preflight báo thiếu giá.
    setFailed(result.failed);
    onDone(lines.length - result.failed.length);
  }

  const zoneName = new Map(zones.map((zone) => [zone.id, `${zone.zoneCode} · ${zone.name}`]));

  return (
    <Modal
      open
      onClose={onClose}
      title="Khai giá hàng loạt"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Đóng
          </Button>
          <Button
            onClick={() => void apply()}
            disabled={!priceValid || selected.length === 0 || bulk.isPending}
            loading={bulk.isPending}
          >
            {progress
              ? `Đang khai ${progress.done}/${progress.total}…`
              : `Áp giá cho ${formatNumber(selected.length)} khu`}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <p className="m-0 text-muted">
          Suất {formatDateTime(session.startsAt)} · {formatNumber(zones.length)} khu chưa có giá.
        </p>

        <Input
          label="Lọc theo mã hoặc tên khu"
          type="search"
          value={query}
          placeholder="Ví dụ: LB, UB, Khán đài"
          onChange={(event) => setQuery(event.target.value)}
        />

        <Input
          label="Giá vé (đồng)"
          type="number"
          min={0}
          step={1000}
          required
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          hint={priceValid ? formatVnd(parsedPrice) : 'Một mức giá cho mọi khu đang chọn.'}
        />

        <Input
          label="Tên hạng vé (không bắt buộc)"
          maxLength={100}
          value={sharedName}
          onChange={(event) => setSharedName(event.target.value)}
          hint="Bỏ trống thì mỗi khu thành một hạng vé mang đúng tên khu."
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-muted">
            Đang chọn {formatNumber(selected.length)}/{formatNumber(matching.length)} khu ·{' '}
            {formatNumber(totalSeats)} chỗ
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setExcluded(new Set())}>
              Chọn hết
            </Button>
            <Button
              variant="secondary"
              onClick={() => setExcluded(new Set(zones.map((zone) => zone.id)))}
            >
              Bỏ hết
            </Button>
          </div>
        </div>

        {/* Trần chiều cao: 91 dòng làm hộp thoại dài hơn màn hình và nút "Áp giá" trôi mất. */}
        <ul className="m-0 grid max-h-[40vh] list-none gap-1 overflow-y-auto p-0">
          {matching.map((zone) => (
            <li key={zone.id}>
              <label className="flex cursor-pointer items-center gap-2 py-1">
                <input
                  type="checkbox"
                  checked={!excluded.has(zone.id)}
                  onChange={() => toggle(zone.id)}
                />
                <span>
                  <strong>{zone.zoneCode}</strong> · {zone.name}
                </span>
                <span className="ms-auto text-muted">{formatNumber(seatsOf(zone))} chỗ</span>
              </label>
            </li>
          ))}
          {matching.length === 0 ? (
            <li className="text-muted">Không khu nào khớp bộ lọc.</li>
          ) : null}
        </ul>

        {failed.length > 0 ? (
          <div role="alert" className="grid gap-1">
            <strong>{formatNumber(failed.length)} khu chưa khai được:</strong>
            <ul className="m-0 ps-5">
              {failed.map((item) => (
                <li key={item.venueZoneId}>
                  {zoneName.get(item.venueZoneId) ?? item.venueZoneId} — {item.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
