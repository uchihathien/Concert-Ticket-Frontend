'use client';

import { ApiError } from '@nexaticket/ts-sdk';
import {
  Badge,
  Button,
  EVENT_CATEGORIES,
  ErrorState,
  FilterBar,
  Input,
  Modal,
  PageHeader,
  Select,
  Table,
  formatNumber,
  useToast,
} from '@nexaticket/ui';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  TEMPLATE_STATUS_LABELS,
  templateStatusTone,
  useCreateTemplate,
  usePlatformTemplates,
  type TemplateRow,
  type TemplateStatus,
} from '@/lib/concert-templates';

/**
 * P-TEMPLATES — khung sự kiện của nền tảng.
 *
 * Khung là một địa điểm + sơ đồ khu dựng sẵn mà tổ chức áp vào để có ngay một sự kiện nháp. Backend
 * có đủ CRUD từ trước nhưng chưa có màn nào: cách duy nhất để phát hành một khung là curl.
 *
 * Vòng đời: Nháp → Đang mở (tổ chức thấy và dùng được) → Lưu trữ (ngừng cho dựng mới).
 */
const STATUS_FILTERS = [
  { value: '', label: 'Mọi trạng thái' },
  { value: 'DRAFT', label: 'Nháp' },
  { value: 'ACTIVE', label: 'Đang mở' },
  { value: 'ARCHIVED', label: 'Đã lưu trữ' },
];

export default function TemplatesPage() {
  const [status, setStatus] = useState<TemplateStatus | ''>('');
  const [creating, setCreating] = useState(false);
  const templates = usePlatformTemplates(status);
  const rows = templates.data ?? [];

  return (
    <>
      <PageHeader
        title="Khung mẫu"
        description="Địa điểm và sơ đồ khu dựng sẵn để tổ chức tạo nhanh sự kiện. Tổ chức chỉ thấy khung đang mở."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus size={18} aria-hidden="true" />
            Tạo khung
          </Button>
        }
      />

      <FilterBar
        actions={
          <Button variant="secondary" disabled={!status} onClick={() => setStatus('')}>
            Xoá bộ lọc
          </Button>
        }
        count={templates.isPending ? 'Đang tải…' : `${formatNumber(rows.length)} khung`}
      >
        <div className="min-w-[200px]">
          <Select
            label="Trạng thái"
            value={status}
            options={STATUS_FILTERS}
            onChange={(event) => setStatus(event.target.value as TemplateStatus | '')}
          />
        </div>
      </FilterBar>

      {templates.isError ? (
        <ErrorState
          error={templates.error instanceof ApiError ? templates.error : null}
          correlationId={templates.error instanceof ApiError ? templates.error.correlationId : null}
          onRetry={() => void templates.refetch()}
        />
      ) : (
        <Table<TemplateRow>
          caption="Khung mẫu"
          loading={templates.isPending}
          rows={rows}
          rowKey={(row) => row.id}
          emptyTitle={status ? 'Không có khung nào ở trạng thái này' : 'Chưa có khung mẫu nào'}
          columns={[
            {
              key: 'name',
              header: 'Khung',
              cell: (row) => (
                <div>
                  <Link href={`/templates/${row.id}`} className="font-semibold">
                    {row.name}
                  </Link>
                  <div className="font-mono text-[12px] text-muted">{row.code}</div>
                </div>
              ),
            },
            {
              key: 'category',
              header: 'Thể loại',
              cell: (row) =>
                EVENT_CATEGORIES.find((item) => item.value === row.category)?.label ?? row.category,
            },
            {
              key: 'status',
              header: 'Trạng thái',
              cell: (row) => (
                <Badge tone={templateStatusTone(row.status)}>
                  {TEMPLATE_STATUS_LABELS[row.status] ?? row.status}
                </Badge>
              ),
            },
            { key: 'zones', header: 'Số khu', cell: (row) => formatNumber(row.zoneCount) },
            { key: 'capacity', header: 'Sức chứa', cell: (row) => formatNumber(row.capacity) },
          ]}
        />
      )}

      {creating ? <CreateTemplateDialog onClose={() => setCreating(false)} /> : null}
    </>
  );
}

function CreateTemplateDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const create = useCreateTemplate();

  const submit = (formData: FormData) => {
    const text = (name: string) => String(formData.get(name) ?? '').trim();
    create.mutate(
      {
        code: text('code'),
        name: text('name'),
        category: text('category'),
        description: text('description') || null,
      },
      {
        onSuccess: (template) => {
          toast.show({ tone: 'success', message: 'Đã tạo khung nháp' });
          onClose();
          // Khung mới chưa có khu, chưa mở được — đưa thẳng sang bước khai khu.
          router.push(`/templates/${template.id}`);
        },
        onError: (error) => toast.showError(error instanceof ApiError ? error : null),
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Tạo khung mẫu"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" form="create-template" loading={create.isPending}>
            Tạo nháp
          </Button>
        </>
      }
    >
      <form id="create-template" action={submit} className="grid gap-4">
        <Input
          name="code"
          label="Mã khung"
          required
          maxLength={40}
          pattern="[A-Za-z0-9_\-]+"
          hint="Chữ, số, gạch dưới, gạch ngang. Không đổi được sau khi tạo."
        />
        <Input name="name" label="Tên khung" required maxLength={200} />
        <Select name="category" label="Thể loại" required options={EVENT_CATEGORIES} />
        <Input name="description" label="Mô tả" maxLength={2000} />
      </form>
    </Modal>
  );
}
