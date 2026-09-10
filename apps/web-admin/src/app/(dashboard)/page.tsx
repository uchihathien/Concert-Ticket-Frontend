'use client';

import {
  ApiError,
  useAdminEvents,
  useCreateEvent,
  usePublishEvent,
  useVenues,
  type AdminEventRow,
  type OrganizationSummary,
} from '@nexaticket/ts-sdk';
import {
  Badge,
  Button,
  EVENT_CATEGORIES,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  Select,
  Table,
  formatDateTime,
  formatNumber,
  useToast,
} from '@nexaticket/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { OrganizationGate } from '@/components/OrganizationGate';

/**
 * A-EVENTS — bảng sự kiện của tổ chức, gồm cả bản nháp.
 *
 * Publish gọi thẳng từ dòng cho nhanh. Điều kiện đủ để publish (`blockers`) chỉ có ở đường đọc
 * chi tiết, nên ở đây ta cứ gửi và để backend từ chối — thông báo lỗi của nó nói rõ còn thiếu gì,
 * chính xác hơn bất cứ suy đoán nào ở client.
 */
export default function EventsPage() {
  return (
    <OrganizationGate title="Sự kiện">
      {(organization) => <EventsContent organization={organization} />}
    </OrganizationGate>
  );
}

/**
 * Nội dung tách riêng vì hook không gọi có điều kiện được: cổng phía trên quyết định có dựng hay
 * không, còn ở đây tổ chức đã chắc chắn tồn tại nên mọi hook chạy vô điều kiện.
 */
function EventsContent({ organization }: { organization: OrganizationSummary }) {
  const toast = useToast();
  const organizationId = organization.id;

  const router = useRouter();
  const events = useAdminEvents(organizationId);
  const venues = useVenues(organizationId);
  const createEvent = useCreateEvent(organizationId);
  const publish = usePublishEvent(organizationId);

  const [formOpen, setFormOpen] = useState(false);

  const submit = (formData: FormData) => {
    createEvent.mutate(
      {
        venueId: String(formData.get('venueId') ?? ''),
        title: String(formData.get('title') ?? '').trim(),
        category: String(formData.get('category') ?? 'khac'),
        summary: String(formData.get('summary') ?? '').trim() || undefined,
      },
      {
        // Sự kiện vừa tạo chưa bán được gì: chưa có suất diễn, chưa có giá. Đưa thẳng sang trang
        // chi tiết thay vì thả người dùng lại bảng danh sách với một dòng nháp và không manh mối
        // nào về bước tiếp theo.
        onSuccess: (event) => {
          setFormOpen(false);
          router.push(`/events/${event.id}?org=${organizationId}`);
        },
        onError: (error) => toast.showError(error instanceof ApiError ? error : null),
      },
    );
  };

  const hasVenue = (venues.data ?? []).length > 0;

  return (
    <>
      <PageHeader
        title="Sự kiện"
        description={`Sự kiện của ${organization.name}, gồm cả bản nháp chưa xuất bản.`}
        actions={
          <Button onClick={() => setFormOpen(true)} disabled={!hasVenue}>
            Tạo sự kiện
          </Button>
        }
      />

      {events.isError ? (
        <ErrorState
          error={events.error instanceof ApiError ? events.error : null}
          correlationId={events.error instanceof ApiError ? events.error.correlationId : null}
          onRetry={() => void events.refetch()}
        />
      ) : !events.isPending && (events.data ?? []).length === 0 && !hasVenue ? (
        // Không thể tạo sự kiện khi chưa có địa điểm — nói thẳng bước tiếp theo thay vì để nút
        // "Tạo sự kiện" mờ đi không rõ lý do.
        <EmptyState
          title="Cần một địa điểm trước"
          description="Sự kiện phải gắn với một địa điểm. Tạo địa điểm rồi quay lại đây."
          action={
            <Link href="/venues">
              <Button>Tới trang Địa điểm</Button>
            </Link>
          }
        />
      ) : (
        <Table<AdminEventRow>
          caption="Danh sách sự kiện"
          loading={events.isPending}
          rows={events.data ?? []}
          rowKey={(row) => row.id}
          emptyTitle="Chưa có sự kiện nào"
          emptyDescription="Tạo sự kiện đầu tiên của tổ chức."
          columns={[
            {
              key: 'title',
              header: 'Sự kiện',
              // Đường vào trang suất diễn & giá vé. Danh sách này không đặt giá được, và trước khi
              // có link ở đây thì không có đường nào tới chỗ đặt giá cả.
              cell: (row) => (
                <Link href={`/events/${row.id}?org=${organizationId}`}>{row.title}</Link>
              ),
            },
            {
              key: 'status',
              header: 'Trạng thái',
              cell: (row) => (
                <Badge tone={row.status === 'PUBLISHED' ? 'success' : 'neutral'}>
                  {row.status === 'PUBLISHED' ? 'Đang bán' : 'Nháp'}
                </Badge>
              ),
            },
            { key: 'venue', header: 'Địa điểm', cell: (row) => row.venueName ?? '—' },
            {
              key: 'next',
              header: 'Suất gần nhất',
              cell: (row) => (row.nextSessionAt ? formatDateTime(row.nextSessionAt) : '—'),
            },
            {
              key: 'sessions',
              header: 'Suất',
              numeric: true,
              cell: (row) => formatNumber(row.sessionCount),
            },
            {
              key: 'capacity',
              header: 'Sức chứa',
              numeric: true,
              cell: (row) => formatNumber(row.capacity),
            },
            {
              key: 'action',
              header: '',
              cell: (row) => (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <Link href={`/events/${row.id}?org=${organizationId}`}>
                    <Button variant="secondary">Suất & giá vé</Button>
                  </Link>
                  <Button
                    variant="secondary"
                    loading={publish.isPending && publish.variables?.eventId === row.id}
                    disabled={publish.isPending}
                    onClick={() =>
                      publish.mutate(
                        { eventId: row.id, publish: row.status !== 'PUBLISHED' },
                        {
                          onError: (error) =>
                            toast.showError(error instanceof ApiError ? error : null),
                        },
                      )
                    }
                  >
                    {row.status === 'PUBLISHED' ? 'Gỡ bán' : 'Xuất bản'}
                  </Button>
                </div>
              ),
            },
          ]}
        />
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Tạo sự kiện"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Huỷ
            </Button>
            <Button type="submit" form="create-event" loading={createEvent.isPending}>
              Tạo nháp
            </Button>
          </>
        }
      >
        <form id="create-event" action={submit} style={{ display: 'grid', gap: 16 }}>
          <Input name="title" label="Tên sự kiện" required maxLength={200} />
          <Select
            name="venueId"
            label="Địa điểm"
            required
            options={(venues.data ?? []).map((venue) => ({
              value: venue.id,
              label: `${venue.name} · ${venue.city}`,
            }))}
          />
          <Select name="category" label="Thể loại" required options={EVENT_CATEGORIES} />
          <Input
            name="summary"
            label="Mô tả ngắn"
            maxLength={500}
            hint="Hiện trên thẻ sự kiện ở trang khách."
          />
        </form>
      </Modal>
    </>
  );
}
