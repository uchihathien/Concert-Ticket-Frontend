'use client';

import {
  ApiError,
  useHasPermission,
  useRenameOrganization,
  type OrganizationSummary,
} from '@nexaticket/ts-sdk';
import {
  Button,
  DetailRows,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  Panel,
  Section,
  Skeleton,
  formatNumber,
  useToast,
} from '@nexaticket/ui';
import { useState } from 'react';
import { OrganizationGate } from '@/components/OrganizationGate';
import {
  usePurchaseLimits,
  useSetPurchaseLimits,
  type PurchaseLimits,
} from '@/lib/purchase-limits';

/**
 * A-SETTINGS — hồ sơ tổ chức và trần mua vé mặc định.
 *
 * Hai endpoint này có ở backend từ trước nhưng web-admin chưa có màn nào gọi: đổi tên chỉ làm được
 * từ phía nền tảng, còn trần mua vé của tổ chức thì không ai đặt được ngoài curl — mọi suất diễn
 * rơi thẳng về mặc định nền tảng.
 */
export default function SettingsPage() {
  return (
    <OrganizationGate title="Cài đặt">
      {(organization) => <SettingsContent organization={organization} />}
    </OrganizationGate>
  );
}

function SettingsContent({ organization }: { organization: OrganizationSummary }) {
  const canEditProfile = useHasPermission('ORG_PROFILE_MANAGE', organization.id);
  const canSetLimits = useHasPermission('ORG_LIMITS_SET', organization.id);

  return (
    <>
      <PageHeader title="Cài đặt" description={`Cấu hình chung của ${organization.name}.`} />
      <ProfileSection organization={organization} canEdit={canEditProfile} />
      <LimitsSection organizationId={organization.id} canSet={canSetLimits} />
    </>
  );
}

function ProfileSection({
  organization,
  canEdit,
}: {
  organization: OrganizationSummary;
  canEdit: boolean;
}) {
  const toast = useToast();
  const rename = useRenameOrganization(organization.id);
  const [name, setName] = useState(organization.name);

  const trimmed = name.trim();
  const dirty = trimmed !== organization.name;

  return (
    <Section
      title="Hồ sơ tổ chức"
      description="Tên hiện trên trang sự kiện và trong email gửi khách."
    >
      <Panel>
        <DetailRows
          rows={[
            { label: 'Mã tổ chức', value: organization.id, mono: true },
            { label: 'Đường dẫn', value: organization.slug, mono: true },
            { label: 'Thành viên', value: formatNumber(organization.memberCount) },
          ]}
        />
        {canEdit ? (
          <form
            className="mt-5 flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!trimmed || !dirty) return;
              rename.mutate(trimmed, {
                onSuccess: () => toast.show({ tone: 'success', message: 'Đã đổi tên tổ chức' }),
                onError: (error) => toast.showError(error instanceof ApiError ? error : null),
              });
            }}
          >
            <div className="min-w-[240px] flex-1">
              <Input
                label="Tên tổ chức"
                required
                maxLength={200}
                value={name}
                onChange={(event) => setName(event.target.value)}
                error={trimmed ? undefined : 'Tên không được để trống.'}
              />
            </div>
            <Button type="submit" loading={rename.isPending} disabled={!trimmed || !dirty}>
              Lưu tên
            </Button>
          </form>
        ) : (
          <p className="m-0 mt-4 text-sm text-muted">
            Chỉ chủ hoặc quản trị viên tổ chức đổi được tên.
          </p>
        )}
      </Panel>
    </Section>
  );
}

const LIMIT_FIELDS: Array<{ key: keyof PurchaseLimits; label: string }> = [
  { key: 'maxSeatedPerHold', label: 'Tối đa ghế ngồi mỗi lần giữ' },
  { key: 'maxStandingPerHold', label: 'Tối đa vé đứng mỗi lần giữ' },
  { key: 'maxUnitsPerHold', label: 'Tối đa vé mỗi lần giữ' },
  { key: 'maxTicketsPerCustomer', label: 'Tối đa vé mỗi khách' },
];

function LimitsSection({ organizationId, canSet }: { organizationId: string; canSet: boolean }) {
  // Đọc cũng cần `ORG_LIMITS_SET`: không có quyền thì không gọi, tránh một khối lỗi 403 vô ích.
  const limits = usePurchaseLimits(canSet ? organizationId : null);

  return (
    <Section
      title="Trần mua vé mặc định"
      description="Áp cho mọi suất diễn chưa tự khai trần. Ô bỏ trống nghĩa là theo mặc định nền tảng, không phải không giới hạn. Chỉ có hiệu lực với suất xuất bản sau khi lưu."
    >
      {!canSet ? (
        <EmptyState
          title="Bạn không có quyền xem hoặc đặt trần mua vé"
          description="Trần mua vé dành cho chủ và quản trị viên tổ chức."
        />
      ) : limits.isPending ? (
        <Panel>
          <Skeleton lines={3} />
        </Panel>
      ) : limits.isError ? (
        <ErrorState
          error={limits.error instanceof ApiError ? limits.error : null}
          correlationId={limits.error instanceof ApiError ? limits.error.correlationId : null}
          onRetry={() => void limits.refetch()}
        />
      ) : (
        // `key` theo dữ liệu: lưu xong thì form dựng lại từ giá trị server vừa trả về.
        <LimitsForm
          key={JSON.stringify(limits.data)}
          organizationId={organizationId}
          initial={limits.data}
        />
      )}
    </Section>
  );
}

function LimitsForm({
  organizationId,
  initial,
}: {
  organizationId: string;
  initial: PurchaseLimits;
}) {
  const toast = useToast();
  const save = useSetPurchaseLimits(organizationId);
  const [values, setValues] = useState<Record<keyof PurchaseLimits, string>>(() => ({
    maxSeatedPerHold: initial.maxSeatedPerHold?.toString() ?? '',
    maxStandingPerHold: initial.maxStandingPerHold?.toString() ?? '',
    maxUnitsPerHold: initial.maxUnitsPerHold?.toString() ?? '',
    maxTicketsPerCustomer: initial.maxTicketsPerCustomer?.toString() ?? '',
  }));

  const errors = Object.fromEntries(
    LIMIT_FIELDS.map(({ key }) => {
      const raw = values[key].trim();
      if (raw === '') return [key, undefined];
      const parsed = Number(raw);
      return [
        key,
        Number.isInteger(parsed) && parsed > 0 ? undefined : 'Nhập số nguyên lớn hơn 0.',
      ];
    }),
  ) as Record<keyof PurchaseLimits, string | undefined>;
  const invalid = Object.values(errors).some(Boolean);

  return (
    <Panel>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (invalid) return;
          const body = Object.fromEntries(
            LIMIT_FIELDS.map(({ key }) => {
              const raw = values[key].trim();
              return [key, raw === '' ? null : Number(raw)];
            }),
          ) as unknown as PurchaseLimits;
          save.mutate(body, {
            onSuccess: () => toast.show({ tone: 'success', message: 'Đã lưu trần mua vé' }),
            onError: (error) => toast.showError(error instanceof ApiError ? error : null),
          });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {LIMIT_FIELDS.map(({ key, label }) => (
            <Input
              key={key}
              name={key}
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              label={label}
              value={values[key]}
              placeholder="Theo mặc định nền tảng"
              error={errors[key]}
              onChange={(event) => setValues((prev) => ({ ...prev, [key]: event.target.value }))}
            />
          ))}
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={save.isPending} disabled={invalid}>
            Lưu trần mua vé
          </Button>
        </div>
      </form>
    </Panel>
  );
}
