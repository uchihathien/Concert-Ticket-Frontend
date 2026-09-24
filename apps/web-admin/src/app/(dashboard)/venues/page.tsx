'use client';

import {
  ApiError,
  useCreateVenue,
  useCreateZone,
  useVenues,
  type AdminVenue,
  type OrganizationSummary,
} from '@nexaticket/ts-sdk';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  FilterBar,
  Input,
  Modal,
  PageHeader,
  Panel,
  Select,
  Skeleton,
  foldText,
  formatNumber,
  matchesText,
  useToast,
} from '@nexaticket/ui';
import { useMemo, useState } from 'react';
import { MapPin, Plus } from 'lucide-react';
import { OrganizationGate } from '@/components/OrganizationGate';

/**
 * A-VENUES — địa điểm riêng của tổ chức và các khu bên trong.
 *
 * Khu ngồi khai theo số hàng × số ghế mỗi hàng; khu đứng khai sức chứa. Form đổi ô nhập theo loại
 * khu thay vì hiện cả bốn ô: backend từ chối hình dạng sai ở tầng domain **và** ở ràng buộc của
 * database, nên để người dùng điền nhầm rồi mới báo lỗi là bắt họ đoán.
 */
export default function VenuesPage() {
  return (
    <OrganizationGate title="Địa điểm">
      {(organization) => <VenuesContent organization={organization} />}
    </OrganizationGate>
  );
}

function VenuesContent({ organization }: { organization: OrganizationSummary }) {
  const toast = useToast();
  const organizationId = organization.id;

  const venues = useVenues(organizationId);
  const createVenue = useCreateVenue(organizationId);

  const [venueQuery, setVenueQuery] = useState('');
  const [venueFormOpen, setVenueFormOpen] = useState(false);
  const [zoneFor, setZoneFor] = useState<AdminVenue | null>(null);

  // Tìm cả trong MÃ KHU, không chỉ tên địa điểm: ban tổ chức thường nhớ "khu VIP nằm ở đâu" chứ
  // không nhớ tên đầy đủ của nhà thi đấu.
  const visibleVenues = useMemo(() => {
    const needle = foldText(venueQuery.trim());
    return (venues.data ?? []).filter((venue) =>
      matchesText(needle, [
        venue.name,
        venue.city,
        venue.address,
        ...venue.zones.map((zone) => zone.zoneCode),
        ...venue.zones.map((zone) => zone.name),
      ]),
    );
  }, [venues.data, venueQuery]);

  const submitVenue = (formData: FormData) => {
    createVenue.mutate(
      {
        name: String(formData.get('name') ?? '').trim(),
        city: String(formData.get('city') ?? '').trim(),
        address: String(formData.get('address') ?? '').trim() || undefined,
      },
      {
        onSuccess: () => setVenueFormOpen(false),
        onError: (error) => toast.showError(error instanceof ApiError ? error : null),
      },
    );
  };

  return (
    <>
      <PageHeader
        title="Địa điểm"
        description="Địa điểm riêng của tổ chức. Mỗi sự kiện gắn với một địa điểm, và khu vực ở đây quyết định hạng vé bán được."
        actions={
          <Button onClick={() => setVenueFormOpen(true)}>
            <Plus size={18} aria-hidden="true" />
            Thêm địa điểm
          </Button>
        }
      />

      {venues.isPending ? (
        <Panel>
          <Skeleton lines={3} />
        </Panel>
      ) : venues.isError ? (
        <ErrorState
          error={venues.error instanceof ApiError ? venues.error : null}
          correlationId={venues.error instanceof ApiError ? venues.error.correlationId : null}
          onRetry={() => void venues.refetch()}
        />
      ) : (venues.data ?? []).length === 0 ? (
        <EmptyState
          title="Chưa có địa điểm nào"
          description="Thêm địa điểm đầu tiên để bắt đầu tạo sự kiện."
          action={<Button onClick={() => setVenueFormOpen(true)}>Thêm địa điểm</Button>}
        />
      ) : (
        <div className="grid gap-4">
          <FilterBar
            count={`${formatNumber(visibleVenues.length)} / ${formatNumber(
              (venues.data ?? []).length,
            )} địa điểm`}
            actions={
              venueQuery ? (
                <Button variant="secondary" onClick={() => setVenueQuery('')}>
                  Xoá bộ lọc
                </Button>
              ) : undefined
            }
          >
            <Input
              label="Tìm địa điểm"
              placeholder="Tên, thành phố hoặc mã khu"
              value={venueQuery}
              onChange={(event) => setVenueQuery(event.target.value)}
            />
          </FilterBar>

          {visibleVenues.length === 0 ? (
            // Khác "chưa có địa điểm nào" ở nhánh trên: ở đây tổ chức CÓ địa điểm, bộ lọc đang
            // giấu chúng đi.
            <EmptyState
              title="Không có địa điểm nào khớp"
              description="Thử bỏ bớt từ khoá tìm kiếm."
            />
          ) : null}

          {visibleVenues.map((venue) => (
            <Panel key={venue.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="m-0 mb-1 flex items-center gap-2 text-lg font-bold">
                    <MapPin size={18} aria-hidden="true" className="text-muted" />
                    {venue.name}
                  </h2>
                  <p className="m-0 text-muted">
                    {venue.city}
                    {venue.address ? ` · ${venue.address}` : ''} · sức chứa{' '}
                    {formatNumber(venue.capacity)}
                  </p>
                </div>
                <Button variant="secondary" onClick={() => setZoneFor(venue)}>
                  <Plus size={16} aria-hidden="true" />
                  Thêm khu vực
                </Button>
              </div>

              {venue.zones.length > 0 ? (
                <ul className="m-0 mt-4 flex list-none flex-wrap gap-2 p-0">
                  {venue.zones.map((zone) => (
                    <li key={zone.id}>
                      <Badge tone={zone.kind === 'SEATED' ? 'neutral' : 'accent'}>
                        {zone.zoneCode} · {zone.name} ·{' '}
                        {zone.kind === 'SEATED'
                          ? `${formatNumber(zone.seatCount)} ghế`
                          : `${formatNumber(zone.capacity ?? 0)} chỗ đứng`}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="m-0 mt-4 text-muted">
                  Chưa có khu vực nào. Chưa có khu thì chưa bán được hạng vé nào.
                </p>
              )}
            </Panel>
          ))}
        </div>
      )}

      <Modal
        open={venueFormOpen}
        onClose={() => setVenueFormOpen(false)}
        title="Thêm địa điểm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setVenueFormOpen(false)}>
              Huỷ
            </Button>
            <Button type="submit" form="create-venue" loading={createVenue.isPending}>
              Thêm
            </Button>
          </>
        }
      >
        <form id="create-venue" action={submitVenue} className="grid gap-4">
          <Input name="name" label="Tên địa điểm" required maxLength={200} />
          <Input name="city" label="Tỉnh/Thành phố" required maxLength={100} />
          <Input name="address" label="Địa chỉ" />
        </form>
      </Modal>

      {zoneFor ? (
        <ZoneDialog
          organizationId={organization.id}
          venue={zoneFor}
          onClose={() => setZoneFor(null)}
        />
      ) : null}
    </>
  );
}

/**
 * Hộp thoại thêm khu vực.
 *
 * Tách thành component riêng vì `useCreateZone` cần `venueId` — hook không gọi có điều kiện được,
 * nên phải để nó sống trong một component chỉ tồn tại khi đã biết địa điểm nào.
 */
function ZoneDialog({
  organizationId,
  venue,
  onClose,
}: {
  organizationId: string;
  venue: AdminVenue;
  onClose: () => void;
}) {
  const toast = useToast();
  const createZone = useCreateZone(organizationId, venue.id);
  const [kind, setKind] = useState<'SEATED' | 'STANDING'>('SEATED');

  const submit = (formData: FormData) => {
    const number = (key: string) => {
      const raw = String(formData.get(key) ?? '').trim();
      return raw === '' ? undefined : Number(raw);
    };

    createZone.mutate(
      {
        zoneCode: String(formData.get('zoneCode') ?? '').trim(),
        name: String(formData.get('name') ?? '').trim(),
        kind,
        // Gửi đúng bộ trường của loại khu đang chọn. Gửi thừa thì domain từ chối.
        ...(kind === 'SEATED'
          ? { rowCount: number('rowCount'), seatsPerRow: number('seatsPerRow') }
          : { capacity: number('capacity') }),
      },
      {
        onSuccess: onClose,
        onError: (error) => toast.showError(error instanceof ApiError ? error : null),
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Thêm khu vực · ${venue.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" form="create-zone" loading={createZone.isPending}>
            Thêm
          </Button>
        </>
      }
    >
      <form id="create-zone" action={submit} className="grid gap-4">
        <Input name="zoneCode" label="Mã khu" required maxLength={16} hint="Ví dụ: A, B, FLOOR." />
        <Input name="name" label="Tên khu" required maxLength={100} />
        <Select
          label="Loại khu"
          value={kind}
          onChange={(event) => setKind(event.target.value as 'SEATED' | 'STANDING')}
          options={[
            { value: 'SEATED', label: 'Ghế đánh số' },
            { value: 'STANDING', label: 'Vé đứng' },
          ]}
        />
        {kind === 'SEATED' ? (
          <>
            <Input name="rowCount" type="number" min={1} label="Số hàng" required />
            <Input name="seatsPerRow" type="number" min={1} label="Số ghế mỗi hàng" required />
          </>
        ) : (
          <Input name="capacity" type="number" min={1} label="Sức chứa" required />
        )}
      </form>
    </Modal>
  );
}
