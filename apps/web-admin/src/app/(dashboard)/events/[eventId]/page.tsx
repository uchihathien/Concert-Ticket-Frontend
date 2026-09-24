'use client';

import {
  ApiError,
  useAdminEvent,
  useCreateSession,
  useCreateTicketType,
  useDeleteSession,
  useDeleteTicketType,
  usePublishEvent,
  useUpdateEvent,
  useUpdateSession,
  useUpdateTicketType,
  type AdminEventDetail,
  type AdminSession,
  type AdminTicketType,
  type AdminZone,
  type OrganizationSummary,
} from '@nexaticket/ts-sdk';
import {
  Badge,
  Button,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  Panel,
  RowActions,
  Section,
  Select,
  Skeleton,
  Table,
  formatDateTime,
  formatNumber,
  formatVnd,
  isoToVnLocal,
  publishBlockerLabel,
  useToast,
  vnLocalToIso,
} from '@nexaticket/ui';
import { ArrowLeft, CalendarPlus, Eye, EyeOff, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { OrganizationGate } from '@/components/OrganizationGate';
import { PosterUploader } from '@/components/PosterUploader';

/**
 * A-EVENT — suất diễn và giá vé của một sự kiện.
 *
 * Đây là chỗ duy nhất đặt được giá: giá không nằm trên ghế mà nằm trên **hạng vé** = (một suất
 * diễn) × (một khu của địa điểm). Ràng buộc `uq_type_zone` của catalog bảo đảm mỗi khu chỉ có đúng
 * một giá trong một suất, nên form ở đây cũng chỉ mời chọn những khu chưa khai giá — để người dùng
 * chọn một khu đã có giá rồi nhận 409 là bắt họ đoán luật của database.
 *
 * <b>Sự kiện đang bán thì không sửa được.</b> Tồn kho ở inventory-service chỉ dựng một lần lúc
 * publish; đổi giá khi đang bán làm khách thấy một giá còn kết toán ra giá khác. Backend chặn bằng
 * `INVALID_EVENT_STATE`; ở đây các nút mờ đi kèm một câu nói rõ phải gỡ bán trước.
 */
export default function EventDetailPage() {
  const params = useParams<{ eventId: string }>();

  return (
    <OrganizationGate title="Sự kiện">
      {(organization) => (
        <EventDetailContent organization={organization} eventId={params.eventId} />
      )}
    </OrganizationGate>
  );
}

function EventDetailContent({
  organization,
  eventId,
}: {
  organization: OrganizationSummary;
  eventId: string;
}) {
  const toast = useToast();
  const organizationId = organization.id;

  const query = useAdminEvent(organizationId, eventId);
  const publish = usePublishEvent(organizationId);
  const updateEvent = useUpdateEvent(organizationId, eventId);
  const deleteSession = useDeleteSession(organizationId, eventId);
  const deleteTicketType = useDeleteTicketType(organizationId, eventId);

  const [sessionForm, setSessionForm] = useState<AdminSession | 'new' | null>(null);
  const [priceForm, setPriceForm] = useState<{
    session: AdminSession;
    ticketType: AdminTicketType | null;
  } | null>(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    body: string;
    run: () => void;
  } | null>(null);

  if (query.isPending) {
    return (
      <>
        <PageHeader title="Sự kiện" />
        <Panel>
          <Skeleton lines={4} />
        </Panel>
      </>
    );
  }

  if (query.isError || !query.data) {
    return (
      <>
        <PageHeader title="Sự kiện" />
        <ErrorState
          error={query.error instanceof ApiError ? query.error : null}
          correlationId={query.error instanceof ApiError ? query.error.correlationId : null}
          onRetry={() => void query.refetch()}
        />
      </>
    );
  }

  const event = query.data;
  const published = event.status === 'PUBLISHED';
  const onError = (error: unknown) => toast.showError(error instanceof ApiError ? error : null);

  return (
    <>
      <PageHeader
        title={event.title}
        description={`${event.venue.name} · ${event.venue.city} · ${formatNumber(event.sessions.length)} suất diễn`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={`/?org=${organizationId}`}>
              <Button variant="secondary">
                <ArrowLeft size={16} aria-hidden="true" />
                Danh sách sự kiện
              </Button>
            </Link>
            <Button variant="secondary" disabled={published} onClick={() => setSessionForm('new')}>
              <CalendarPlus size={16} aria-hidden="true" />
              Thêm suất diễn
            </Button>
            <Button
              loading={publish.isPending}
              onClick={() =>
                publish.mutate({ eventId: event.id, publish: !published }, { onError })
              }
            >
              {published ? (
                <EyeOff size={16} aria-hidden="true" />
              ) : (
                <Eye size={16} aria-hidden="true" />
              )}
              {published ? 'Gỡ bán' : 'Xuất bản'}
            </Button>
          </div>
        }
      />

      <Panel>
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={published ? 'success' : 'neutral'}>{statusLabel(event.status)}</Badge>
          <span className="text-muted">
            {published
              ? 'Đang bán. Gỡ bán trước khi sửa suất diễn hoặc giá vé — đổi giá lúc đang bán thì khách thấy một giá, kết toán ra giá khác.'
              : event.blockers.length === 0
                ? 'Đủ điều kiện xuất bản.'
                : 'Còn vướng mắc, chưa xuất bản được:'}
          </span>
        </div>

        {!published && event.blockers.length > 0 ? (
          <ul className="m-0 mt-3 list-disc ps-5 text-muted">
            {event.blockers.map((blocker) => (
              <li key={blocker}>{publishBlockerLabel(blocker)}</li>
            ))}
          </ul>
        ) : null}
      </Panel>

      {/*
        Ảnh bìa sửa được cả khi đang bán, khác hẳn suất diễn và giá vé.

        Lý do: đổi ảnh không đụng gì tới tồn kho hay số tiền khách đã trả. Khoá nó lại theo cùng
        luật với giá vé là bắt ban tổ chức gỡ cả sự kiện xuống chỉ để thay một tấm ảnh mờ.
      */}
      <Section
        title="Ảnh bìa"
        description="Hiện trên thẻ sự kiện ở trang khách. Chưa có thì hệ thống dùng một dải màu riêng cho sự kiện này."
      >
        <PosterUploader
          organizationId={organizationId}
          posterUrl={event.posterUrl}
          coverSeed={event.slug}
          onSave={async (posterUrl) => {
            // Chuỗi rỗng = xoá ảnh. Backend phân biệt nó với `null` ("không đổi gì"), nên đừng
            // chuẩn hoá về undefined ở đây.
            await updateEvent.mutateAsync({ posterUrl });
          }}
        />
      </Section>

      <div className="mt-4 grid gap-4">
        {event.sessions.map((session) => (
          <SessionPanel
            key={session.id}
            event={event}
            session={session}
            editable={!published}
            onAddPrice={() => setPriceForm({ session, ticketType: null })}
            onEditPrice={(ticketType) => setPriceForm({ session, ticketType })}
            onEditSession={() => setSessionForm(session)}
            onDeleteSession={() =>
              setConfirm({
                title: 'Xoá suất diễn',
                body: `Xoá suất ${formatDateTime(session.startsAt)}? Toàn bộ hạng vé và giá của suất này mất theo.`,
                run: () => deleteSession.mutate({ sessionId: session.id }, { onError }),
              })
            }
            onDeletePrice={(ticketType) =>
              setConfirm({
                title: 'Xoá hạng vé',
                body: `Xoá "${ticketType.name}" (${formatVnd(ticketType.priceVnd)})? Khu ${ticketType.zoneCode} sẽ không bán được ở suất này cho tới khi khai giá lại.`,
                run: () =>
                  deleteTicketType.mutate(
                    { sessionId: session.id, ticketTypeId: ticketType.id },
                    { onError },
                  ),
              })
            }
          />
        ))}

        {event.sessions.length === 0 ? (
          <Panel>
            <h2 className="m-0 mb-1 text-lg font-bold">Chưa có suất diễn nào</h2>
            <p className="m-0 text-muted">
              Giá vé khai theo từng suất diễn, nên phải có suất trước rồi mới đặt giá cho từng khu.
            </p>
          </Panel>
        ) : null}
      </div>

      {sessionForm ? (
        <SessionDialog
          organizationId={organizationId}
          eventId={event.id}
          session={sessionForm === 'new' ? null : sessionForm}
          onClose={() => setSessionForm(null)}
        />
      ) : null}

      {priceForm ? (
        <TicketTypeDialog
          organizationId={organizationId}
          eventId={event.id}
          session={priceForm.session}
          ticketType={priceForm.ticketType}
          zones={unpricedZones(event, priceForm.session)}
          onClose={() => setPriceForm(null)}
        />
      ) : null}

      {confirm ? (
        <Modal
          open
          onClose={() => setConfirm(null)}
          title={confirm.title}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirm(null)}>
                Huỷ
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  confirm.run();
                  setConfirm(null);
                }}
              >
                Xoá
              </Button>
            </>
          }
        >
          <p className="m-0">{confirm.body}</p>
        </Modal>
      ) : null}
    </>
  );
}

/** Một suất diễn với bảng giá của nó. */
function SessionPanel({
  event,
  session,
  editable,
  onAddPrice,
  onEditPrice,
  onDeletePrice,
  onEditSession,
  onDeleteSession,
}: {
  event: AdminEventDetail;
  session: AdminSession;
  editable: boolean;
  onAddPrice: () => void;
  onEditPrice: (ticketType: AdminTicketType) => void;
  onDeletePrice: (ticketType: AdminTicketType) => void;
  onEditSession: () => void;
  onDeleteSession: () => void;
}) {
  const missing = unpricedZones(event, session);

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 mb-1 text-lg font-bold">
            {formatDateTime(session.startsAt)}
            {session.endsAt ? ` → ${formatDateTime(session.endsAt)}` : ''}
          </h2>
          <p className="m-0 text-muted">
            Mở bán {session.salesOpenAt ? formatDateTime(session.salesOpenAt) : '—'} · đóng bán{' '}
            {session.salesCloseAt ? formatDateTime(session.salesCloseAt) : '—'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={!editable || missing.length === 0}
            onClick={onAddPrice}
          >
            Thêm hạng vé
          </Button>
          <Button variant="secondary" disabled={!editable} onClick={onEditSession}>
            Sửa suất
          </Button>
          <Button variant="secondary" disabled={!editable} onClick={onDeleteSession}>
            Xoá suất
          </Button>
        </div>
      </div>

      <Table<AdminTicketType>
        caption={`Hạng vé của suất ${formatDateTime(session.startsAt)}`}
        rows={session.ticketTypes}
        rowKey={(row) => row.id}
        emptyTitle="Chưa khai giá cho khu nào"
        emptyDescription="Suất này chưa bán được vé nào. Thêm hạng vé để đặt giá cho từng khu của địa điểm."
        columns={[
          {
            key: 'zone',
            header: 'Khu',
            cell: (row) => `${row.zoneCode} · ${row.zoneName}`,
          },
          { key: 'name', header: 'Hạng vé', cell: (row) => row.name },
          {
            key: 'price',
            header: 'Giá vé',
            numeric: true,
            cell: (row) => formatVnd(row.priceVnd),
          },
          {
            key: 'capacity',
            header: 'Số chỗ',
            numeric: true,
            cell: (row) => formatNumber(row.capacity),
          },
          {
            key: 'action',
            header: '',
            cell: (row) => (
              <RowActions>
                <Button variant="secondary" disabled={!editable} onClick={() => onEditPrice(row)}>
                  <Pencil size={16} aria-hidden="true" />
                  Sửa giá
                </Button>
                <Button
                  variant="danger-soft"
                  disabled={!editable}
                  onClick={() => onDeletePrice(row)}
                >
                  <Trash2 size={16} aria-hidden="true" />
                  Xoá
                </Button>
              </RowActions>
            ),
          },
        ]}
      />

      {session.ticketTypes.length > 0 ? (
        // Khu chưa có giá là khu không bán được vé nào, và bảng trên không cho thấy điều đó — nó
        // chỉ liệt kê những khu ĐÃ khai giá. Khi không còn khu nào thì vẫn phải nói ra, nếu không
        // nút "Thêm hạng vé" mờ đi mà không ai biết vì sao.
        <p className="m-0 mt-3 text-muted">
          {missing.length > 0
            ? `Chưa có giá: ${missing.map((zone) => `${zone.zoneCode} · ${zone.name}`).join(', ')}.`
            : 'Mọi khu của địa điểm đều đã có giá ở suất này.'}
        </p>
      ) : null}
    </Panel>
  );
}

/**
 * Thêm hoặc sửa một suất diễn.
 *
 * Component riêng vì hook mutation cần biết đang tạo hay đang sửa, mà hook thì không gọi có điều
 * kiện được — hộp thoại chỉ tồn tại khi câu trả lời đã rõ.
 */
function SessionDialog({
  organizationId,
  eventId,
  session,
  onClose,
}: {
  organizationId: string;
  eventId: string;
  session: AdminSession | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const create = useCreateSession(organizationId, eventId);
  const update = useUpdateSession(organizationId, eventId);
  const pending = create.isPending || update.isPending;

  const submit = (formData: FormData) => {
    const startsAt = vnLocalToIso(String(formData.get('startsAt') ?? ''));
    const salesOpenAt = vnLocalToIso(String(formData.get('salesOpenAt') ?? ''));
    const salesCloseAt = vnLocalToIso(String(formData.get('salesCloseAt') ?? ''));
    // Ô nhập đã `required`; kiểm lại chỉ để TypeScript biết ba mốc này chắc chắn có.
    if (!startsAt || !salesOpenAt || !salesCloseAt) return;

    const limits = {
      maxSeatedPerHold: optionalNumber(formData.get('maxSeatedPerHold')),
      maxStandingPerHold: optionalNumber(formData.get('maxStandingPerHold')),
      maxUnitsPerHold: optionalNumber(formData.get('maxUnitsPerHold')),
      maxTicketsPerCustomer: optionalNumber(formData.get('maxTicketsPerCustomer')),
    };

    const request = {
      startsAt,
      endsAt: vnLocalToIso(String(formData.get('endsAt') ?? '')),
      salesOpenAt,
      salesCloseAt,
      ...limits,
    };

    const options = {
      onSuccess: onClose,
      onError: (error: unknown) => toast.showError(error instanceof ApiError ? error : null),
    };

    if (session) update.mutate({ sessionId: session.id, ...request }, options);
    else create.mutate(request, options);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={session ? 'Sửa suất diễn' : 'Thêm suất diễn'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" form="session-form" loading={pending}>
            Lưu
          </Button>
        </>
      }
    >
      <form id="session-form" action={submit} className="grid gap-4">
        <Input
          name="startsAt"
          type="datetime-local"
          label="Bắt đầu"
          required
          defaultValue={isoToVnLocal(session?.startsAt)}
          hint="Giờ Việt Nam."
        />
        <Input
          name="endsAt"
          type="datetime-local"
          label="Kết thúc"
          defaultValue={isoToVnLocal(session?.endsAt)}
        />
        <Input
          name="salesOpenAt"
          type="datetime-local"
          label="Mở bán"
          required
          defaultValue={isoToVnLocal(session?.salesOpenAt)}
        />
        <Input
          name="salesCloseAt"
          type="datetime-local"
          label="Đóng bán"
          required
          defaultValue={isoToVnLocal(session?.salesCloseAt)}
        />
        <Input
          name="maxSeatedPerHold"
          type="number"
          min={1}
          label="Tối đa ghế ngồi mỗi lần giữ"
          defaultValue={session?.maxSeatedPerHold ?? ''}
          // Trần bỏ trống KHÔNG phải "giữ nguyên": backend ghi đè bằng đúng thứ form gửi lên, và
          // trống nghĩa là quay về mặc định nền tảng.
          hint="Bỏ trống là theo mặc định nền tảng."
        />
        <Input
          name="maxStandingPerHold"
          type="number"
          min={1}
          label="Tối đa vé đứng mỗi lần giữ"
          defaultValue={session?.maxStandingPerHold ?? ''}
        />
        <Input
          name="maxUnitsPerHold"
          type="number"
          min={1}
          label="Tối đa vé mỗi lần giữ"
          defaultValue={session?.maxUnitsPerHold ?? ''}
        />
        <Input
          name="maxTicketsPerCustomer"
          type="number"
          min={1}
          label="Tối đa vé mỗi khách"
          defaultValue={session?.maxTicketsPerCustomer ?? ''}
        />
      </form>
    </Modal>
  );
}

/** Khai giá cho một khu, hoặc sửa giá đã khai. Không đổi được khu — đó là một hạng vé khác. */
function TicketTypeDialog({
  organizationId,
  eventId,
  session,
  ticketType,
  zones,
  onClose,
}: {
  organizationId: string;
  eventId: string;
  session: AdminSession;
  ticketType: AdminTicketType | null;
  zones: AdminZone[];
  onClose: () => void;
}) {
  const toast = useToast();
  const create = useCreateTicketType(organizationId, eventId, session.id);
  const update = useUpdateTicketType(organizationId, eventId);
  const pending = create.isPending || update.isPending;

  const [zoneId, setZoneId] = useState(zones[0]?.id ?? '');
  const [price, setPrice] = useState(String(ticketType?.priceVnd ?? ''));
  const zone = zones.find((item) => item.id === zoneId);

  const submit = (formData: FormData) => {
    const name = String(formData.get('name') ?? '').trim();
    const priceVnd = Number(String(formData.get('priceVnd') ?? '').trim());
    if (!Number.isFinite(priceVnd)) return;

    const options = {
      onSuccess: onClose,
      onError: (error: unknown) => toast.showError(error instanceof ApiError ? error : null),
    };

    if (ticketType) {
      update.mutate(
        { sessionId: session.id, ticketTypeId: ticketType.id, name, priceVnd },
        options,
      );
    } else {
      create.mutate({ venueZoneId: zoneId, name, priceVnd }, options);
    }
  };

  const parsedPrice = Number(price);

  return (
    <Modal
      open
      onClose={onClose}
      title={ticketType ? `Sửa giá · ${ticketType.zoneCode}` : 'Thêm hạng vé'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" form="ticket-type-form" loading={pending}>
            Lưu
          </Button>
        </>
      }
    >
      <form id="ticket-type-form" action={submit} className="grid gap-4">
        <p className="m-0 text-muted">Suất {formatDateTime(session.startsAt)}</p>

        {ticketType ? (
          <p className="m-0">
            Khu <strong>{ticketType.zoneCode}</strong> · {ticketType.zoneName} ·{' '}
            {formatNumber(ticketType.capacity)} chỗ
          </p>
        ) : (
          <Select
            label="Khu vực"
            required
            value={zoneId}
            onChange={(event) => setZoneId(event.target.value)}
            options={zones.map((item) => ({
              value: item.id,
              label: `${item.zoneCode} · ${item.name} · ${formatNumber(
                item.kind === 'SEATED' ? item.seatCount : (item.capacity ?? 0),
              )} chỗ`,
            }))}
            hint="Chỉ liệt kê khu chưa có giá ở suất này — mỗi khu chỉ có đúng một mức giá."
          />
        )}

        <Input
          // `key` để ô tên nạp lại mặc định khi đổi khu; không có nó thì defaultValue đứng yên ở
          // khu chọn đầu tiên.
          key={zoneId}
          name="name"
          label="Tên hạng vé"
          required
          maxLength={100}
          defaultValue={ticketType?.name ?? zone?.name ?? ''}
          hint="Tên khách nhìn thấy khi chọn chỗ, ví dụ “Hạng A” hay “VIP”."
        />

        <Input
          name="priceVnd"
          type="number"
          min={0}
          step={1000}
          label="Giá vé (đồng)"
          required
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          hint={
            price.trim() !== '' && Number.isFinite(parsedPrice) && parsedPrice >= 0
              ? formatVnd(parsedPrice)
              : 'Nhập số tiền một vé, đơn vị đồng.'
          }
        />
      </form>
    </Modal>
  );
}

/** Khu của địa điểm chưa được khai giá ở suất này. Rỗng nghĩa là mọi khu đều đã có giá. */
function unpricedZones(event: AdminEventDetail, session: AdminSession): AdminZone[] {
  const priced = new Set(session.ticketTypes.map((type) => type.venueZoneId));
  return event.venue.zones.filter((zone) => !priced.has(zone.id));
}

function optionalNumber(value: FormDataEntryValue | null): number | undefined {
  const raw = String(value ?? '').trim();
  if (raw === '') return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function statusLabel(status: AdminEventDetail['status']): string {
  if (status === 'PUBLISHED') return 'Đang bán';
  if (status === 'UNPUBLISHED') return 'Đã gỡ bán';
  if (status === 'CANCELLED') return 'Đã huỷ';
  return 'Nháp';
}
