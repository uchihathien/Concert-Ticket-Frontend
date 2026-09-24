'use client';

import {
  useEventMasterData,
  useOrganizationDashboard,
  type EventMasterData,
  type OrganizationDashboard,
  type OrganizationSummary,
  type SessionReport,
} from '@nexaticket/ts-sdk';
import {
  Badge,
  EmptyState,
  ErrorState,
  MoneyText,
  PageHeader,
  Panel,
  Section,
  Select,
  Skeleton,
  StatCard,
  StatGrid,
  Table,
  formatDateTime,
  formatNumber,
} from '@nexaticket/ui';
import { CalendarDays, Ticket, TriangleAlert, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { OrganizationGate } from '@/components/OrganizationGate';
import styles from './overview.module.css';

/**
 * A-OVERVIEW — bảng điều khiển của ban tổ chức.
 *
 * <h3>Một bộ chọn, một nguồn dữ liệu</h3>
 *
 * Chọn một sự kiện là nạp **toàn bộ** master data của nó trong một request: chi tiết, khu vực,
 * trạng thái từng chỗ theo khu, số vé bán và doanh thu theo từng suất. Việc ghép ba service nằm ở
 * backend (`OrganizationDashboardQuery`) chứ không ở đây — bốn app frontend tự ghép là bốn bản sao
 * của cùng quy tắc, và bản lệch là bản ban tổ chức dùng để ra quyết định.
 *
 * <h3>"0" và "chưa biết" không được trông giống nhau</h3>
 *
 * Backend trả 200 kèm `degraded` khi một service phía sau im lặng, thay vì 500 cho cả trang. Nên
 * `grossVnd: 0` có hai nghĩa: "chưa bán được đồng nào" và "không hỏi được doanh thu". Trang này
 * hiện "—" cho nghĩa thứ hai. Hiện "0đ" là báo sai cho ban tổ chức về chính tiền của họ.
 */
export default function OverviewPage() {
  return (
    <OrganizationGate title="Tổng quan">
      {(organization) => <OverviewBody organization={organization} />}
    </OrganizationGate>
  );
}

function OverviewBody({ organization }: { organization: OrganizationSummary }) {
  const dashboard = useOrganizationDashboard(organization.id);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const events = useMemo(() => dashboard.data?.events ?? [], [dashboard.data]);

  // Sự kiện đang xem: lựa chọn của người dùng, hoặc sự kiện đầu danh sách khi họ chưa chọn gì.
  // Không dùng `useEffect` để đặt state ban đầu — điều đó tạo một lần dựng thừa với bộ chọn rỗng,
  // và với danh sách dài thì cái nháy đó nhìn thấy được.
  const activeEventId = selectedEventId ?? events[0]?.id ?? null;
  const masterData = useEventMasterData(organization.id, activeEventId);

  if (dashboard.isPending) {
    return (
      <>
        <PageHeader title="Tổng quan" description={organization.name} />
        <Panel>
          <Skeleton lines={4} />
        </Panel>
      </>
    );
  }

  if (dashboard.isError) {
    return (
      <>
        <PageHeader title="Tổng quan" description={organization.name} />
        <ErrorState error={null} onRetry={() => void dashboard.refetch()} />
      </>
    );
  }

  const data = dashboard.data as OrganizationDashboard;
  const salesDown = data.degraded.length > 0;

  return (
    <>
      <PageHeader title="Tổng quan" description={organization.name} />

      {salesDown ? <DegradedNotice services={data.degraded} /> : null}

      <StatGrid>
        <StatCard
          label="Sự kiện"
          value={data.totals.eventCount}
          hint={`${data.totals.publishedCount} đang bán · ${data.totals.draftCount} nháp`}
          icon={<CalendarDays size={16} aria-hidden="true" />}
        />
        <StatCard
          label="Sức chứa đã khai"
          value={data.totals.capacity}
          hint="Gồm cả sự kiện còn nháp"
          icon={<Users size={16} aria-hidden="true" />}
        />
        {/* `null` khi analytics im lặng: StatCard vẽ khối chờ thay vì con số 0 sai sự thật. */}
        <StatCard
          label="Vé đã bán"
          value={salesDown ? null : data.totals.ticketsSold}
          hint={salesDown ? 'Chưa hỏi được' : 'Toàn tổ chức'}
          icon={<Ticket size={16} aria-hidden="true" />}
        />
        <StatCard
          label="Doanh thu"
          value={salesDown ? null : data.totals.grossVnd}
          hint={salesDown ? 'Chưa hỏi được' : 'Tổng khách trả'}
        />
      </StatGrid>

      {events.length === 0 ? (
        <EmptyState
          title="Chưa có sự kiện nào"
          description="Dựng sự kiện đầu tiên ở mục Sự kiện, hoặc chọn một khung concert của Tổng công ty."
        />
      ) : (
        <Section
          title="Chi tiết sự kiện"
          description="Chọn một sự kiện để xem toàn bộ số liệu của nó."
          actions={
            <Select
              label="Sự kiện"
              value={activeEventId ?? ''}
              onChange={(event) => setSelectedEventId(event.target.value)}
              options={events.map((row) => ({
                value: row.id,
                label: `${row.title}${row.status === 'DRAFT' ? ' (nháp)' : ''}`,
              }))}
            />
          }
        >
          <EventMaster
            query={masterData}
            onRetry={() => void masterData.refetch()}
          />
        </Section>
      )}
    </>
  );
}

/**
 * Nói rõ service nào im lặng, không nói chung chung "có lỗi".
 *
 * Ban tổ chức không sửa được sự cố, nhưng họ cần biết con số nào đang thiếu để không ra quyết
 * định dựa vào nó — và để nói đúng chuyện khi gọi hỗ trợ.
 */
function DegradedNotice({ services }: { services: string[] }) {
  return (
    <Panel className={styles.degraded}>
      <TriangleAlert size={18} aria-hidden="true" />
      <div>
        <p className={styles.degradedTitle}>Một phần số liệu chưa hỏi được</p>
        <p className={styles.degradedBody}>
          Không kết nối được: {services.join(', ')}. Những ô hiện dấu “—” chưa có số, không phải
          bằng 0.
        </p>
      </div>
    </Panel>
  );
}

function EventMaster({
  query,
  onRetry,
}: {
  query: ReturnType<typeof useEventMasterData>;
  onRetry: () => void;
}) {
  if (query.isPending) {
    return <Skeleton lines={5} />;
  }
  if (query.isError) {
    return <ErrorState error={null} onRetry={onRetry} />;
  }

  const data = query.data as EventMasterData;
  const seatingDown = data.degraded.some((service) => service.includes('inventory'));
  const salesDown = data.degraded.some((service) => service.includes('analytics'));

  return (
    <div className={styles.master}>
      <StatGrid>
        <StatCard
          label="Sức chứa đã khai"
          value={data.totals.declaredCapacity}
          hint="Cộng theo từng suất"
        />
        {/*
          Lệch giữa "đã khai" và "đã dựng" nghĩa là sơ đồ đổi sau lần publish gần nhất. Đó không
          phải lỗi, nhưng là thứ đáng để mắt — nên nó được nêu thành một ô riêng thay vì ẩn đi.
        */}
        <StatCard
          label="Chỗ đã dựng"
          value={seatingDown ? null : data.totals.materializedSeats}
          hint={
            seatingDown
              ? 'Chưa hỏi được'
              : data.totals.materializedSeats === data.totals.declaredCapacity
                ? 'Khớp với sơ đồ'
                : 'Lệch với sơ đồ đã khai'
          }
          tone={
            !seatingDown && data.totals.materializedSeats !== data.totals.declaredCapacity
              ? 'warn'
              : 'default'
          }
        />
        <StatCard
          label="Vé đã bán"
          value={salesDown ? null : data.totals.ticketsSold}
          hint={salesDown ? 'Chưa hỏi được' : undefined}
        />
        <StatCard
          label="Doanh thu"
          value={salesDown ? null : data.totals.grossVnd}
          hint={salesDown ? 'Chưa hỏi được' : 'Tổng khách trả'}
        />
      </StatGrid>

      <Table<SessionReport>
        caption="Theo từng suất diễn"
        rows={data.sessions}
        rowKey={(row) => row.eventSessionId}
        emptyTitle="Sự kiện chưa có suất diễn nào"
        columns={[
          {
            key: 'startsAt',
            header: 'Suất diễn',
            cell: (row) => formatDateTime(row.startsAt),
          },
          {
            key: 'state',
            header: 'Tồn kho',
            cell: (row) =>
              row.seating === null ? (
                // Hai lý do rất khác nhau cho cùng một ô trống, và ban tổ chức phải phân biệt
                // được: "chưa publish" là việc của họ, "chưa hỏi được" thì không.
                <Badge tone={seatingDown ? 'warn' : 'neutral'}>
                  {seatingDown ? 'Chưa hỏi được' : 'Chưa dựng'}
                </Badge>
              ) : (
                <Badge tone="success">Đang bán</Badge>
              ),
          },
          {
            key: 'available',
            header: 'Còn trống',
            numeric: true,
            cell: (row) => (row.seating ? formatNumber(row.seating.totals.available) : '—'),
          },
          {
            key: 'sold',
            header: 'Đã bán',
            numeric: true,
            cell: (row) => (row.seating ? formatNumber(row.seating.totals.sold) : '—'),
          },
          {
            key: 'tickets',
            header: 'Vé phát hành',
            numeric: true,
            cell: (row) => (row.sales ? formatNumber(row.sales.ticketsSold) : '—'),
          },
          {
            key: 'gross',
            header: 'Doanh thu',
            numeric: true,
            cell: (row) => (row.sales ? <MoneyText amountVnd={row.sales.grossVnd} /> : '—'),
          },
        ]}
      />

      <ZoneBreakdown sessions={data.sessions} />
    </div>
  );
}

/**
 * Còn trống theo khu, gộp mọi suất.
 *
 * Gộp chứ không tách theo suất: ban tổ chức nhìn bảng này để biết khu nào bán chậm, và một sự
 * kiện ba suất thì ba bảng cạnh nhau bắt họ tự cộng nhẩm.
 */
function ZoneBreakdown({ sessions }: { sessions: SessionReport[] }) {
  const zones = useMemo(() => {
    const byZone = new Map<string, { zoneCode: string; available: number; sold: number; total: number }>();
    for (const session of sessions) {
      for (const zone of session.seating?.zones ?? []) {
        const current = byZone.get(zone.zoneCode) ?? {
          zoneCode: zone.zoneCode,
          available: 0,
          sold: 0,
          total: 0,
        };
        current.available += zone.available;
        current.sold += zone.sold;
        current.total += zone.total;
        byZone.set(zone.zoneCode, current);
      }
    }
    return [...byZone.values()].sort((a, b) => a.zoneCode.localeCompare(b.zoneCode));
  }, [sessions]);

  if (zones.length === 0) {
    return null;
  }

  return (
    <Table
      caption="Theo khu vực"
      rows={zones}
      rowKey={(row) => row.zoneCode}
      columns={[
        { key: 'zone', header: 'Khu', cell: (row) => row.zoneCode },
        {
          key: 'sold',
          header: 'Đã bán',
          numeric: true,
          cell: (row) => formatNumber(row.sold),
        },
        {
          key: 'available',
          header: 'Còn trống',
          numeric: true,
          cell: (row) => formatNumber(row.available),
        },
        {
          key: 'fill',
          header: 'Tỷ lệ lấp đầy',
          numeric: true,
          cell: (row) => (row.total === 0 ? '—' : `${Math.round((row.sold / row.total) * 100)}%`),
        },
      ]}
    />
  );
}
