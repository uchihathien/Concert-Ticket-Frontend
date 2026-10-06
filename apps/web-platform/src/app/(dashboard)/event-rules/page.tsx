'use client';

import {
  ApiError,
  useAdminEvents,
  useEventRules,
  usePlatformOrganizations,
  useSaveEventRules,
  type EventRules,
} from '@nexaticket/ts-sdk';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  Panel,
  Section,
  Select,
  Skeleton,
  formatDateTime,
  useToast,
} from '@nexaticket/ui';
import { useState } from 'react';
// Cùng kiểu ô soạn thảo với Kho tri thức — một kiểu textarea cho cả khu nền tảng.
import styles from '../knowledge/knowledge.module.css';

/**
 * P-RULES — quy định riêng của từng sự kiện cho trợ lý hỗ trợ
 * (`GET/PUT /v1/support/knowledge/rules/{eventId}`, cần quyền bàn hỗ trợ).
 *
 * Hook `useEventRules` / `useSaveEventRules` có trong SDK nhưng chưa màn nào gọi. Khác kho tri thức
 * (các đoạn rời được tìm theo nghĩa), quy định là MỘT văn bản trọn vẹn cho một sự kiện, trợ lý đọc
 * nguyên văn qua tool — chỉ khi đã công bố.
 *
 * Chọn sự kiện qua tổ chức → danh sách sự kiện quản trị, vì danh mục công khai không trả id sự kiện
 * và không có sự kiện nháp. Ô nhập mã là đường dự phòng khi đã có sẵn id.
 */
const ORG_LIMIT = 100;

export default function EventRulesPage() {
  const [organizationId, setOrganizationId] = useState('');
  const [eventId, setEventId] = useState('');
  const [manualId, setManualId] = useState('');
  const [eventTitle, setEventTitle] = useState('');

  const organizations = usePlatformOrganizations({ limit: ORG_LIMIT });
  const events = useAdminEvents(organizationId || null);

  const orgOptions = [
    { value: '', label: 'Chọn tổ chức…' },
    ...(organizations.data ?? []).map((row) => ({ value: row.id, label: row.name })),
  ];
  const eventOptions = [
    { value: '', label: events.isPending && organizationId ? 'Đang tải…' : 'Chọn sự kiện…' },
    ...(events.data ?? []).map((row) => ({ value: row.id, label: row.title })),
  ];

  const pickEvent = (id: string) => {
    setEventId(id);
    setEventTitle(events.data?.find((row) => row.id === id)?.title ?? '');
  };

  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  return (
    <>
      <PageHeader
        title="Quy định sự kiện"
        description="Văn bản quy định riêng của một sự kiện mà trợ lý hỗ trợ đọc nguyên văn khi khách hỏi. Bản nháp thì khách và trợ lý đều không thấy."
      />

      <Section title="Chọn sự kiện">
        <Panel>
          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="Tổ chức"
              value={organizationId}
              options={orgOptions}
              disabled={organizations.isPending}
              onChange={(event) => {
                setOrganizationId(event.target.value);
                setEventId('');
                setEventTitle('');
              }}
            />
            <Select
              label="Sự kiện"
              value={eventId}
              options={eventOptions}
              disabled={!organizationId || events.isPending}
              onChange={(event) => pickEvent(event.target.value)}
            />
          </div>

          {organizations.isError ? (
            <div className="mt-4">
              <ErrorState
                error={organizations.error instanceof ApiError ? organizations.error : null}
                correlationId={
                  organizations.error instanceof ApiError ? organizations.error.correlationId : null
                }
                onRetry={() => void organizations.refetch()}
              />
            </div>
          ) : null}
          {events.isError ? (
            <div className="mt-4">
              <ErrorState
                error={events.error instanceof ApiError ? events.error : null}
                correlationId={events.error instanceof ApiError ? events.error.correlationId : null}
                onRetry={() => void events.refetch()}
              />
            </div>
          ) : null}
          {organizationId && events.data && events.data.length === 0 ? (
            <p className="m-0 mt-3 text-sm text-muted">Tổ chức này chưa có sự kiện nào.</p>
          ) : null}
          {(organizations.data?.length ?? 0) >= ORG_LIMIT ? (
            <p className="m-0 mt-3 text-sm text-muted">
              Danh sách chỉ hiện {ORG_LIMIT} tổ chức đầu. Không thấy tổ chức cần tìm thì nhập mã sự
              kiện bên dưới.
            </p>
          ) : null}

          <form
            className="mt-4 flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const id = manualId.trim();
              if (!uuid.test(id)) return;
              setEventId(id);
              setEventTitle('');
            }}
          >
            <div className="min-w-[280px] flex-1">
              <Input
                label="Hoặc nhập mã sự kiện"
                value={manualId}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="font-mono"
                onChange={(event) => setManualId(event.target.value)}
                error={
                  manualId.trim() && !uuid.test(manualId.trim())
                    ? 'Mã sự kiện là một UUID.'
                    : undefined
                }
              />
            </div>
            <Button type="submit" variant="secondary" disabled={!uuid.test(manualId.trim())}>
              Mở
            </Button>
          </form>
        </Panel>
      </Section>

      {eventId ? (
        <RulesEditorSection key={eventId} eventId={eventId} fallbackTitle={eventTitle} />
      ) : (
        <EmptyState
          title="Chưa chọn sự kiện"
          description="Chọn tổ chức và sự kiện để xem hoặc soạn quy định."
        />
      )}
    </>
  );
}

function RulesEditorSection({
  eventId,
  fallbackTitle,
}: {
  eventId: string;
  fallbackTitle: string;
}) {
  const rules = useEventRules(eventId);
  // Chưa có quy định không phải lỗi: đó là trạng thái bắt đầu của mọi sự kiện.
  const notFound = rules.error instanceof ApiError && rules.error.code === 'EVENT_RULES_NOT_FOUND';

  return (
    <Section title="Quy định">
      {rules.isPending ? (
        <Panel>
          <Skeleton lines={5} />
        </Panel>
      ) : rules.isError && !notFound ? (
        <ErrorState
          error={rules.error instanceof ApiError ? rules.error : null}
          correlationId={rules.error instanceof ApiError ? rules.error.correlationId : null}
          onRetry={() => void rules.refetch()}
        />
      ) : (
        <RulesForm
          key={rules.data?.updatedAt ?? 'new'}
          eventId={eventId}
          initial={rules.data ?? null}
          fallbackTitle={fallbackTitle}
        />
      )}
    </Section>
  );
}

function RulesForm({
  eventId,
  initial,
  fallbackTitle,
}: {
  eventId: string;
  initial: EventRules | null;
  fallbackTitle: string;
}) {
  const toast = useToast();
  const save = useSaveEventRules(eventId);
  const [title, setTitle] = useState(initial?.eventTitle ?? fallbackTitle);
  const [content, setContent] = useState(initial?.content ?? '');

  const submit = (published: boolean) => {
    save.mutate(
      { eventTitle: title.trim(), content: content.trim(), published },
      {
        onSuccess: () =>
          toast.show({
            tone: 'success',
            message: published ? 'Đã công bố quy định' : 'Đã lưu bản nháp',
          }),
        onError: (error) => toast.showError(error instanceof ApiError ? error : null),
      },
    );
  };

  const valid = title.trim().length > 0 && content.trim().length > 0;

  return (
    <Panel>
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          {initial ? (
            <>
              <Badge tone={initial.published ? 'success' : 'neutral'}>
                {initial.published ? 'Đã công bố' : 'Bản nháp'}
              </Badge>
              <span>Cập nhật {formatDateTime(initial.updatedAt)}</span>
            </>
          ) : (
            <Badge tone="neutral">Chưa có quy định — đang soạn mới</Badge>
          )}
        </div>

        <Input
          label="Tên sự kiện"
          required
          maxLength={200}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          hint="Trợ lý dùng tên này khi trích dẫn quy định."
        />

        <label className={styles.field}>
          <span className={styles.label}>
            Nội dung quy định <span aria-hidden="true">*</span>
          </span>
          <textarea
            className={styles.textarea}
            required
            maxLength={20000}
            rows={14}
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
          <span className={styles.hint}>
            {content.length.toLocaleString('vi-VN')} / 20.000 ký tự. Lưu là ghi đè cả bản.
          </span>
        </label>

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="secondary"
            loading={save.isPending && save.variables?.published === false}
            disabled={!valid || save.isPending}
            onClick={() => submit(false)}
          >
            Lưu nháp
          </Button>
          <Button
            loading={save.isPending && save.variables?.published === true}
            disabled={!valid || save.isPending}
            onClick={() => submit(true)}
          >
            Công bố
          </Button>
        </div>
      </div>
    </Panel>
  );
}
