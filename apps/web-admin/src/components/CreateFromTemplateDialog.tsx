'use client';

import { ApiError } from '@nexaticket/ts-sdk';
import {
  Button,
  EVENT_CATEGORIES,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  Select,
  Skeleton,
  formatNumber,
  formatVnd,
  useToast,
  vnLocalToIso,
} from '@nexaticket/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  useCreateEventFromTemplate,
  useUsableTemplate,
  useUsableTemplates,
  type TemplateDetail,
} from '@/lib/concert-templates';

/**
 * Dựng trọn một sự kiện nháp từ khung của nền tảng: địa điểm, khu, một suất diễn và giá vé.
 *
 * Hai bước trong cùng một hộp thoại: chọn khung (danh sách chỉ có khung ACTIVE), rồi điền phần
 * riêng của sự kiện. Giá mỗi khu điền sẵn giá gợi ý của khung; khu không có giá gợi ý thì bắt buộc
 * nhập, khớp đúng luật `ZONE_PRICE_REQUIRED` của backend.
 */
export function CreateFromTemplateDialog({
  organizationId,
  onClose,
}: {
  organizationId: string;
  onClose: () => void;
}) {
  const templates = useUsableTemplates(organizationId);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const detail = useUsableTemplate(organizationId, templateId);

  const rows = templates.data ?? [];

  return (
    <Modal
      open
      onClose={onClose}
      title="Tạo sự kiện từ khung mẫu"
      footer={
        detail.data ? null : (
          <Button variant="secondary" onClick={onClose}>
            Đóng
          </Button>
        )
      }
    >
      {templates.isPending ? (
        <Skeleton lines={3} />
      ) : templates.isError ? (
        <ErrorState
          error={templates.error instanceof ApiError ? templates.error : null}
          correlationId={templates.error instanceof ApiError ? templates.error.correlationId : null}
          onRetry={() => void templates.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Chưa có khung mẫu nào"
          description="Nền tảng chưa phát hành khung sự kiện nào. Bạn vẫn tạo được sự kiện theo cách thường."
        />
      ) : (
        <div className="grid gap-4">
          <Select
            label="Khung mẫu"
            value={templateId ?? ''}
            onChange={(event) => setTemplateId(event.target.value || null)}
            options={[
              { value: '', label: 'Chọn một khung…' },
              ...rows.map((row) => ({
                value: row.id,
                label: `${row.name} · ${formatNumber(row.zoneCount)} khu · ${formatNumber(row.capacity)} chỗ`,
              })),
            ]}
          />

          {templateId === null ? null : detail.isPending ? (
            <Skeleton lines={4} />
          ) : detail.isError ? (
            <ErrorState
              error={detail.error instanceof ApiError ? detail.error : null}
              correlationId={detail.error instanceof ApiError ? detail.error.correlationId : null}
              onRetry={() => void detail.refetch()}
            />
          ) : (
            <TemplateForm
              key={detail.data.id}
              organizationId={organizationId}
              template={detail.data}
              onClose={onClose}
            />
          )}
        </div>
      )}
    </Modal>
  );
}

function TemplateForm({
  organizationId,
  template,
  onClose,
}: {
  organizationId: string;
  template: TemplateDetail;
  onClose: () => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const create = useCreateEventFromTemplate(organizationId);
  const [error, setError] = useState<string | null>(null);

  const zones = [...template.zones].sort((a, b) => a.sortOrder - b.sortOrder);
  const knownCategory = EVENT_CATEGORIES.some((item) => item.value === template.category);

  const submit = (formData: FormData) => {
    setError(null);
    const text = (name: string) => String(formData.get(name) ?? '').trim();
    const startsAt = vnLocalToIso(text('startsAt'));
    const salesOpenAt = vnLocalToIso(text('salesOpenAt'));
    const salesCloseAt = vnLocalToIso(text('salesCloseAt'));
    if (!startsAt || !salesOpenAt || !salesCloseAt) return;

    if (Date.parse(salesOpenAt) >= Date.parse(salesCloseAt)) {
      setError('Giờ mở bán phải trước giờ đóng bán.');
      return;
    }

    const zonePrices: Record<string, number> = {};
    for (const zone of zones) {
      const raw = text(`price-${zone.zoneCode}`);
      if (raw === '') continue;
      const price = Number(raw);
      if (!Number.isInteger(price) || price < 0) {
        setError(`Giá của khu ${zone.name} phải là số nguyên không âm.`);
        return;
      }
      zonePrices[zone.zoneCode] = price;
    }

    create.mutate(
      {
        templateId: template.id,
        title: text('title'),
        category: text('category') || undefined,
        summary: text('summary') || undefined,
        venueName: text('venueName'),
        city: text('city'),
        address: text('address') || undefined,
        startsAt,
        endsAt: vnLocalToIso(text('endsAt')),
        salesOpenAt,
        salesCloseAt,
        zonePrices,
      },
      {
        onSuccess: (event) => {
          toast.show({ tone: 'success', message: 'Đã dựng sự kiện nháp từ khung mẫu' });
          onClose();
          router.push(`/events/${event.id}?org=${organizationId}`);
        },
        onError: (failure) => toast.showError(failure instanceof ApiError ? failure : null),
      },
    );
  };

  return (
    <form action={submit} className="grid gap-4">
      {template.description ? (
        <p className="m-0 text-sm text-muted">{template.description}</p>
      ) : null}

      <Input name="title" label="Tên sự kiện" required maxLength={200} />
      <Select
        name="category"
        label="Thể loại"
        defaultValue={knownCategory ? template.category : undefined}
        options={EVENT_CATEGORIES}
      />
      <Input name="summary" label="Mô tả ngắn" maxLength={500} />

      <fieldset className="m-0 grid gap-4 border-0 p-0 sm:grid-cols-2">
        <legend className="mb-2 font-semibold">Địa điểm mới</legend>
        <Input name="venueName" label="Tên địa điểm" required maxLength={200} />
        <Input name="city" label="Thành phố" required maxLength={100} />
        <Input name="address" label="Địa chỉ" className="sm:col-span-2" />
      </fieldset>

      <fieldset className="m-0 grid gap-4 border-0 p-0 sm:grid-cols-2">
        <legend className="mb-2 font-semibold">Suất diễn đầu tiên (giờ Việt Nam)</legend>
        <Input name="startsAt" type="datetime-local" label="Bắt đầu" required />
        <Input name="endsAt" type="datetime-local" label="Kết thúc" />
        <Input name="salesOpenAt" type="datetime-local" label="Mở bán" required />
        <Input name="salesCloseAt" type="datetime-local" label="Đóng bán" required />
      </fieldset>

      <fieldset className="m-0 grid gap-3 border-0 p-0">
        <legend className="mb-2 font-semibold">
          Giá vé theo khu ({formatNumber(zones.length)} khu)
        </legend>
        <div className="grid max-h-[320px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
          {zones.map((zone) => (
            <Input
              key={zone.id}
              name={`price-${zone.zoneCode}`}
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              label={`${zone.name} (${formatNumber(zone.seatCount || zone.capacity || 0)} chỗ)`}
              defaultValue={zone.suggestedPriceVnd ?? ''}
              required={zone.suggestedPriceVnd === null}
              hint={
                zone.suggestedPriceVnd === null
                  ? 'Khung không gợi ý giá — bắt buộc nhập.'
                  : `Gợi ý: ${formatVnd(zone.suggestedPriceVnd)}`
              }
            />
          ))}
        </div>
      </fieldset>

      {error ? (
        <p role="alert" className="m-0 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" type="button" onClick={onClose}>
          Huỷ
        </Button>
        <Button type="submit" loading={create.isPending}>
          Dựng sự kiện nháp
        </Button>
      </div>
    </form>
  );
}
