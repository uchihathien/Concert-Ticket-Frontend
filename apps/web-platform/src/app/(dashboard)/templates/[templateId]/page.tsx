'use client';

import { ApiError } from '@nexaticket/ts-sdk';
import {
  Badge,
  Button,
  DetailRows,
  EVENT_CATEGORIES,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  PageSkeleton,
  Panel,
  Section,
  Select,
  formatNumber,
  useToast,
} from '@nexaticket/ui';
import { Archive, ArrowLeft, CheckCircle2, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  TEMPLATE_STATUS_LABELS,
  templateStatusTone,
  useDeleteTemplate,
  usePlatformTemplate,
  useReplaceTemplateZones,
  useTemplateStatus,
  useUpdateTemplate,
  type TemplateDetail,
  type TemplateZone,
  type TemplateZoneInput,
} from '@/lib/concert-templates';

/**
 * P-TEMPLATE — một khung mẫu.
 *
 * Sửa bảng khu ở đây là sửa SỐ LIỆU (tên, loại, hàng × ghế, sức chứa, giá gợi ý, thứ tự). Hình học
 * (toạ độ, góc, sân khấu) của khu đã có được gửi lại nguyên vẹn; khu thêm mới không kèm hình học
 * và để backend tự xếp. Màn này không có trình vẽ mặt bằng.
 */
export default function TemplateDetailPage() {
  const params = useParams<{ templateId: string }>();
  const template = usePlatformTemplate(params.templateId);

  if (template.isError) {
    return (
      <>
        <BackLink />
        <PageHeader title="Khung mẫu" />
        <ErrorState
          error={template.error instanceof ApiError ? template.error : null}
          correlationId={template.error instanceof ApiError ? template.error.correlationId : null}
          onRetry={() => void template.refetch()}
        />
      </>
    );
  }

  if (!template.data) {
    return (
      <>
        <BackLink />
        <PageSkeleton rows={6} />
      </>
    );
  }

  return <TemplateView template={template.data} />;
}

function BackLink() {
  return (
    <p className="mb-3 mt-0">
      <Link
        href="/templates"
        className="inline-flex items-center gap-1 text-[13px] text-muted no-underline hover:text-ink"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Mọi khung mẫu
      </Link>
    </p>
  );
}

function TemplateView({ template }: { template: TemplateDetail }) {
  const toast = useToast();
  const router = useRouter();
  const status = useTemplateStatus(template.id);
  const remove = useDeleteTemplate(template.id);

  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fail = (error: unknown) => toast.showError(error instanceof ApiError ? error : null);
  const changeStatus = (action: 'activate' | 'archive' | 'draft', message: string) =>
    status.mutate(action, {
      onSuccess: () => toast.show({ tone: 'success', message }),
      onError: fail,
    });

  const categoryLabel =
    EVENT_CATEGORIES.find((item) => item.value === template.category)?.label ?? template.category;

  return (
    <>
      <BackLink />
      <PageHeader
        title={template.name}
        description={`Khung ${template.code}. Tổ chức chỉ thấy khung khi đang mở.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil size={16} aria-hidden="true" />
              Sửa thông tin
            </Button>
            {template.status !== 'ACTIVE' ? (
              <Button
                loading={status.isPending && status.variables === 'activate'}
                disabled={status.isPending || template.zones.length === 0}
                title={
                  template.zones.length === 0 ? 'Khai ít nhất một khu trước khi mở' : undefined
                }
                onClick={() => changeStatus('activate', 'Đã mở khung cho tổ chức dùng')}
              >
                <CheckCircle2 size={16} aria-hidden="true" />
                Mở cho tổ chức
              </Button>
            ) : null}
            {template.status === 'ACTIVE' ? (
              <Button
                variant="secondary"
                loading={status.isPending && status.variables === 'draft'}
                disabled={status.isPending}
                onClick={() => changeStatus('draft', 'Đã đưa khung về nháp')}
              >
                <RotateCcw size={16} aria-hidden="true" />
                Về nháp để sửa
              </Button>
            ) : null}
            {template.status !== 'ARCHIVED' ? (
              <Button
                variant="secondary"
                loading={status.isPending && status.variables === 'archive'}
                disabled={status.isPending}
                onClick={() => changeStatus('archive', 'Đã lưu trữ khung')}
              >
                <Archive size={16} aria-hidden="true" />
                Lưu trữ
              </Button>
            ) : null}
            <Button variant="danger" onClick={() => setDeleting(true)}>
              <Trash2 size={16} aria-hidden="true" />
              Xoá
            </Button>
          </div>
        }
      />

      <Panel>
        <DetailRows
          rows={[
            { label: 'Mã khung', value: template.code, mono: true },
            {
              label: 'Trạng thái',
              value: (
                <Badge tone={templateStatusTone(template.status)}>
                  {TEMPLATE_STATUS_LABELS[template.status] ?? template.status}
                </Badge>
              ),
            },
            { label: 'Thể loại', value: categoryLabel },
            { label: 'Sức chứa', value: formatNumber(template.capacity) },
            { label: 'Mô tả', value: template.description || '—' },
          ]}
        />
        {template.status === 'ACTIVE' ? (
          <p className="m-0 mt-4 text-sm text-muted">
            Khung đang mở: tổ chức có thể áp khung trong lúc bạn sửa. Nên đưa về nháp trước khi sửa
            bảng khu. Sự kiện đã dựng từ khung không bị ảnh hưởng vì khu đã được chép sang.
          </p>
        ) : null}
      </Panel>

      <ZonesSection template={template} />

      {editing ? (
        <EditTemplateDialog template={template} onClose={() => setEditing(false)} />
      ) : null}

      <Modal
        open={deleting}
        dismissible={!remove.isPending}
        onClose={() => setDeleting(false)}
        title="Xoá khung mẫu?"
        footer={
          <>
            <Button
              variant="secondary"
              disabled={remove.isPending}
              onClick={() => setDeleting(false)}
            >
              Quay lại
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() =>
                remove.mutate(undefined, {
                  onSuccess: () => {
                    toast.show({ tone: 'success', message: 'Đã xoá khung mẫu' });
                    router.replace('/templates');
                  },
                  onError: (error) => {
                    setDeleting(false);
                    fail(error);
                  },
                })
              }
            >
              Xoá vĩnh viễn
            </Button>
          </>
        }
      >
        <p className="m-0">
          Chỉ xoá được khung chưa tổ chức nào dùng. Nếu đã có sự kiện dựng từ khung này, hệ thống sẽ
          từ chối — khi đó hãy <strong>lưu trữ</strong>.
        </p>
      </Modal>
    </>
  );
}

function EditTemplateDialog({
  template,
  onClose,
}: {
  template: TemplateDetail;
  onClose: () => void;
}) {
  const toast = useToast();
  const update = useUpdateTemplate(template.id);
  const known = EVENT_CATEGORIES.some((item) => item.value === template.category);

  const submit = (formData: FormData) => {
    const text = (name: string) => String(formData.get(name) ?? '').trim();
    update.mutate(
      {
        name: text('name'),
        category: text('category'),
        description: text('description'),
      },
      {
        onSuccess: () => {
          toast.show({ tone: 'success', message: 'Đã lưu thông tin khung' });
          onClose();
        },
        onError: (error) => toast.showError(error instanceof ApiError ? error : null),
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Sửa thông tin khung"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" form="edit-template" loading={update.isPending}>
            Lưu
          </Button>
        </>
      }
    >
      <form id="edit-template" action={submit} className="grid gap-4">
        <Input
          name="name"
          label="Tên khung"
          required
          maxLength={200}
          defaultValue={template.name}
        />
        <Select
          name="category"
          label="Thể loại"
          required
          defaultValue={known ? template.category : undefined}
          options={
            known
              ? EVENT_CATEGORIES
              : [{ value: template.category, label: template.category }, ...EVENT_CATEGORIES]
          }
        />
        <Input
          name="description"
          label="Mô tả"
          maxLength={2000}
          defaultValue={template.description ?? ''}
        />
      </form>
    </Modal>
  );
}

/* ---------------------------------------------------------------------------
 * Bảng khu
 * ------------------------------------------------------------------------- */

interface ZoneDraft {
  /** Khoá React; khu cũ dùng id, khu mới dùng số tạm. */
  key: string;
  zoneCode: string;
  name: string;
  kind: 'SEATED' | 'STANDING';
  rowCount: string;
  seatsPerRow: string;
  capacity: string;
  suggestedPriceVnd: string;
  /** Hình học của khu cũ, gửi lại nguyên vẹn. `null` với khu mới. */
  original: TemplateZone | null;
}

const KIND_OPTIONS = [
  { value: 'SEATED', label: 'Ghế ngồi' },
  { value: 'STANDING', label: 'Đứng' },
];

function toDraft(zone: TemplateZone): ZoneDraft {
  return {
    key: zone.id,
    zoneCode: zone.zoneCode,
    name: zone.name,
    kind: zone.kind,
    rowCount: zone.rowCount?.toString() ?? '',
    seatsPerRow: zone.seatsPerRow?.toString() ?? '',
    capacity: zone.capacity?.toString() ?? '',
    suggestedPriceVnd: zone.suggestedPriceVnd?.toString() ?? '',
    original: zone,
  };
}

function ZonesSection({ template }: { template: TemplateDetail }) {
  const [editing, setEditing] = useState(false);
  const zones = [...template.zones].sort((a, b) => a.sortOrder - b.sortOrder);
  // Đầu vào PUT chỉ nhận `GRID|ARC`; khu `TABLE` gửi lại sẽ bị từ chối hoặc mất hình học.
  const hasTable = zones.some((zone) => zone.layout?.shape === 'TABLE');

  return (
    <Section
      title="Khu vực"
      description="Số khu, số chỗ và giá gợi ý. Tổ chức điền giá thật khi dựng sự kiện; khu không có giá gợi ý thì bắt buộc điền."
      actions={
        !editing ? (
          <Button
            variant="secondary"
            disabled={hasTable}
            title={
              hasTable ? 'Khung có khu dạng bàn — màn này chưa sửa được loại khu đó' : undefined
            }
            onClick={() => setEditing(true)}
          >
            <Pencil size={16} aria-hidden="true" />
            Sửa bảng khu
          </Button>
        ) : null
      }
    >
      {editing ? (
        <ZonesEditor template={template} zones={zones} onDone={() => setEditing(false)} />
      ) : zones.length === 0 ? (
        <Panel>
          <p className="m-0 text-muted">
            Khung chưa có khu nào, nên chưa mở được cho tổ chức. Bấm “Sửa bảng khu” để khai.
          </p>
        </Panel>
      ) : (
        <Panel>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">Khu vực của khung</caption>
              <thead>
                <tr className="text-muted">
                  <th className="py-2 pr-3 font-medium">Mã</th>
                  <th className="py-2 pr-3 font-medium">Tên</th>
                  <th className="py-2 pr-3 font-medium">Loại</th>
                  <th className="py-2 pr-3 text-right font-medium">Số chỗ</th>
                  <th className="py-2 text-right font-medium">Giá gợi ý</th>
                </tr>
              </thead>
              <tbody>
                {zones.map((zone) => (
                  <tr key={zone.id} className="border-t border-[var(--nt-border)]">
                    <td className="py-2 pr-3 font-mono text-[12px]">{zone.zoneCode}</td>
                    <td className="py-2 pr-3">{zone.name}</td>
                    <td className="py-2 pr-3">
                      {zone.kind === 'SEATED'
                        ? `Ngồi · ${zone.rowCount ?? '?'} hàng × ${zone.seatsPerRow ?? '?'}`
                        : 'Đứng'}
                    </td>
                    <td className="py-2 pr-3 text-right">{formatNumber(zone.seatCount)}</td>
                    <td className="py-2 text-right">
                      {zone.suggestedPriceVnd === null
                        ? '—'
                        : `${formatNumber(zone.suggestedPriceVnd)} ₫`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </Section>
  );
}

function ZonesEditor({
  template,
  zones,
  onDone,
}: {
  template: TemplateDetail;
  zones: TemplateZone[];
  onDone: () => void;
}) {
  const toast = useToast();
  const replace = useReplaceTemplateZones(template.id);
  const [drafts, setDrafts] = useState<ZoneDraft[]>(() => zones.map(toDraft));
  const [nextKey, setNextKey] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const patch = (key: string, change: Partial<ZoneDraft>) =>
    setDrafts((prev) => prev.map((row) => (row.key === key ? { ...row, ...change } : row)));

  const positive = (raw: string) => {
    if (raw.trim() === '') return null;
    const value = Number(raw);
    return Number.isInteger(value) && value > 0 ? value : NaN;
  };

  const save = () => {
    setError(null);
    if (drafts.length === 0) {
      setError('Khung phải có ít nhất một khu. Muốn bỏ hết khu thì xoá khung.');
      return;
    }
    const codes = new Set<string>();
    const body: TemplateZoneInput[] = [];

    for (const [index, row] of drafts.entries()) {
      const code = row.zoneCode.trim();
      const label = row.name.trim() || code || `dòng ${index + 1}`;
      if (!code || !row.name.trim()) {
        setError(`Khu ${label}: cần cả mã và tên.`);
        return;
      }
      if (codes.has(code)) {
        setError(`Mã khu ${code} bị trùng.`);
        return;
      }
      codes.add(code);

      const rowCount = positive(row.rowCount);
      const seatsPerRow = positive(row.seatsPerRow);
      const capacity = positive(row.capacity);
      if ([rowCount, seatsPerRow, capacity].some((value) => Number.isNaN(value))) {
        setError(`Khu ${label}: số hàng, số ghế, sức chứa phải là số nguyên dương.`);
        return;
      }
      if (row.kind === 'SEATED' && (rowCount === null || seatsPerRow === null)) {
        setError(`Khu ${label}: khu ghế ngồi cần số hàng và số ghế mỗi hàng.`);
        return;
      }
      if (row.kind === 'STANDING' && capacity === null) {
        setError(`Khu ${label}: khu đứng cần sức chứa.`);
        return;
      }
      let price: number | null = null;
      if (row.suggestedPriceVnd.trim() !== '') {
        price = Number(row.suggestedPriceVnd);
        if (!Number.isInteger(price) || price < 0) {
          setError(`Khu ${label}: giá gợi ý phải là số nguyên không âm.`);
          return;
        }
      }

      const layout = row.original?.layout ?? null;
      body.push({
        zoneCode: code,
        name: row.name.trim(),
        kind: row.kind,
        rowCount: row.kind === 'SEATED' ? rowCount : null,
        seatsPerRow: row.kind === 'SEATED' ? seatsPerRow : null,
        capacity: row.kind === 'STANDING' ? capacity : null,
        sortOrder: index,
        suggestedPriceVnd: price,
        layoutShape: layout?.shape ?? null,
        originX: layout?.originX ?? null,
        originY: layout?.originY ?? null,
        rotationDeg: layout?.rotationDeg ?? null,
        innerRadius: layout?.innerRadius ?? null,
        startAngleDeg: layout?.startAngleDeg ?? null,
        endAngleDeg: layout?.endAngleDeg ?? null,
      });
    }

    const stage = template.stage
      ? {
          shape: template.stage.shape,
          x: template.stage.x,
          y: template.stage.y,
          width: template.stage.width,
          height: template.stage.height,
        }
      : null;

    replace.mutate(
      { stage, zones: body },
      {
        onSuccess: () => {
          toast.show({ tone: 'success', message: 'Đã lưu bảng khu' });
          onDone();
        },
        onError: (failure) => toast.showError(failure instanceof ApiError ? failure : null),
      },
    );
  };

  return (
    <Panel>
      <div className="grid gap-4">
        {drafts.map((row, index) => (
          <fieldset
            key={row.key}
            className="m-0 grid gap-3 rounded-[var(--nt-radius)] border border-[var(--nt-border)] p-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <legend className="px-1 text-sm font-semibold">
              Khu {index + 1}
              {row.original ? '' : ' (mới)'}
            </legend>
            <Input
              label="Mã khu"
              required
              maxLength={16}
              value={row.zoneCode}
              onChange={(event) => patch(row.key, { zoneCode: event.target.value })}
            />
            <Input
              label="Tên khu"
              required
              maxLength={100}
              value={row.name}
              onChange={(event) => patch(row.key, { name: event.target.value })}
            />
            <Select
              label="Loại"
              value={row.kind}
              options={KIND_OPTIONS}
              onChange={(event) =>
                patch(row.key, { kind: event.target.value as ZoneDraft['kind'] })
              }
            />
            <Input
              label="Giá gợi ý (đồng)"
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              value={row.suggestedPriceVnd}
              onChange={(event) => patch(row.key, { suggestedPriceVnd: event.target.value })}
            />
            {row.kind === 'SEATED' ? (
              <>
                <Input
                  label="Số hàng"
                  type="number"
                  min={1}
                  required
                  value={row.rowCount}
                  onChange={(event) => patch(row.key, { rowCount: event.target.value })}
                />
                <Input
                  label="Ghế mỗi hàng"
                  type="number"
                  min={1}
                  required
                  value={row.seatsPerRow}
                  onChange={(event) => patch(row.key, { seatsPerRow: event.target.value })}
                />
              </>
            ) : (
              <Input
                label="Sức chứa"
                type="number"
                min={1}
                required
                value={row.capacity}
                onChange={(event) => patch(row.key, { capacity: event.target.value })}
              />
            )}
            <div className="flex items-end">
              <Button
                variant="ghost"
                onClick={() => setDrafts((prev) => prev.filter((item) => item.key !== row.key))}
              >
                <Trash2 size={16} aria-hidden="true" />
                Bỏ khu này
              </Button>
            </div>
          </fieldset>
        ))}

        <div>
          <Button
            variant="secondary"
            onClick={() => {
              setDrafts((prev) => [
                ...prev,
                {
                  key: `new-${nextKey}`,
                  zoneCode: '',
                  name: '',
                  kind: 'SEATED',
                  rowCount: '',
                  seatsPerRow: '',
                  capacity: '',
                  suggestedPriceVnd: '',
                  original: null,
                },
              ]);
              setNextKey((value) => value + 1);
            }}
          >
            <Plus size={16} aria-hidden="true" />
            Thêm khu
          </Button>
        </div>

        <p className="m-0 text-sm text-muted">
          Lưu là thay cả bảng khu. Vị trí trên mặt bằng của khu cũ được giữ nguyên; khu mới do hệ
          thống tự xếp.
        </p>

        {error ? (
          <p role="alert" className="m-0 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" disabled={replace.isPending} onClick={onDone}>
            Huỷ
          </Button>
          <Button loading={replace.isPending} onClick={save}>
            Lưu bảng khu
          </Button>
        </div>
      </div>
    </Panel>
  );
}
