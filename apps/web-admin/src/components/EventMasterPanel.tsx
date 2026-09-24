'use client';

import type {
  AdminSession,
  AdminTicketType,
  AdminZone,
  EventMasterData,
  SessionReport,
} from '@nexaticket/ts-sdk';
import {
  Badge,
  BarChart,
  DetailRows,
  MoneyText,
  Panel,
  StatCard,
  StatGrid,
  Table,
  eventCategoryLabel,
  formatDateTime,
  formatNumber,
} from '@nexaticket/ui';
import { TriangleAlert } from 'lucide-react';
import { useMemo } from 'react';
import styles from './event-master-panel.module.css';

/**
 * Toàn bộ master data của một sự kiện, trên một màn hình.
 *
 * <h3>Vì sao gộp hết vào đây thay vì rải ra nhiều trang</h3>
 *
 * Ban tổ chức mở màn hình này để trả lời một câu duy nhất: "sự kiện của tôi đang thế nào". Câu đó
 * cần cả số bán, cả tồn kho theo khu, cả giá từng hạng vé, cả trần mua mỗi người — và nếu chúng nằm
 * ở bốn trang thì họ phải tự ghép trong đầu, mỗi lần một cách khác nhau.
 *
 * <h3>Thứ tự các khối là thứ tự câu hỏi</h3>
 *
 * Bán được bao nhiêu → còn thiếu gì để bán được → bán ở đâu chậm → giá và trần đang khai thế nào.
 * Số liệu trước, cấu hình sau: cấu hình chỉ được xem lại khi số liệu cho thấy có gì đó lệch.
 *
 * <h3>"0" và "chưa biết" không được trông giống nhau</h3>
 *
 * Backend trả 200 kèm `degraded` khi một service phía sau im lặng. Nên mọi con số đến từ service có
 * tên trong danh sách ấy phải hiện là "—". Hiện "0đ" cho "chưa hỏi được doanh thu" là báo sai cho
 * ban tổ chức về chính tiền của họ.
 */
export function EventMasterPanel({ data }: { data: EventMasterData }) {
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
          Lệch giữa "đã khai" và "đã dựng" nghĩa là sơ đồ đổi sau lần publish gần nhất. Không phải
          lỗi, nhưng là thứ đáng để mắt — nên nó là một ô riêng thay vì bị ẩn đi.
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

      <Identity data={data} />
      <Blockers reasons={data.event.blockers} status={data.event.status} />
      <Insights data={data} seatingDown={seatingDown} salesDown={salesDown} />

      <div className={styles.charts}>
        <Panel>
          <RevenueBySession sessions={data.sessions} down={salesDown} />
        </Panel>
        <Panel>
          <FillByZone sessions={data.sessions} down={seatingDown} />
        </Panel>
      </div>

      <Panel>
        <SessionTable sessions={data.sessions} seatingDown={seatingDown} />
      </Panel>

      <Panel>
        <ZoneTable sessions={data.sessions} zones={data.event.venue.zones} />
      </Panel>

      <Panel>
        <TicketTypeTable sessions={data.event.sessions} />
      </Panel>

      <Panel>
        <LimitTable sessions={data.event.sessions} />
      </Panel>
    </div>
  );
}

/** Sự kiện này là cái gì, ở đâu, đang ở trạng thái nào. */
function Identity({ data }: { data: EventMasterData }) {
  const { event } = data;

  return (
    <Panel>
      <h3 className={styles.blockTitle}>Thông tin sự kiện</h3>
      <DetailRows
        rows={[
          { label: 'Tên', value: event.title },
          { label: 'Đường dẫn', value: `/${event.slug}`, mono: true },
          { label: 'Phân loại', value: eventCategoryLabel(event.category) },
          { label: 'Trạng thái', value: <StatusBadge status={event.status} /> },
          {
            label: 'Công bố lúc',
            value: event.publishedAt ? formatDateTime(event.publishedAt) : 'Chưa công bố',
          },
          { label: 'Địa điểm', value: `${event.venue.name} · ${event.venue.city}` },
          {
            label: 'Sức chứa địa điểm',
            value: `${formatNumber(event.venue.capacity)} chỗ · ${event.venue.zones.length} khu`,
          },
          { label: 'Số suất diễn', value: formatNumber(event.sessions.length) },
        ]}
      />
    </Panel>
  );
}

function StatusBadge({ status }: { status: EventMasterData['event']['status'] }) {
  if (status === 'PUBLISHED') {
    return <Badge tone="success">Đang bán</Badge>;
  }
  if (status === 'CANCELLED') {
    return <Badge tone="danger">Đã huỷ</Badge>;
  }
  if (status === 'UNPUBLISHED') {
    return <Badge tone="warn">Đã rút xuống</Badge>;
  }
  return <Badge tone="neutral">Nháp</Badge>;
}

/**
 * Còn thiếu gì để bán được vé.
 *
 * Backend đã tính sẵn danh sách này (`blockers`) — hiện nó ra là biến một nút Publish bị vô hiệu
 * không rõ lý do thành một danh sách việc phải làm. Sự kiện đã công bố thì khối này không xuất
 * hiện: nó là hướng dẫn, không phải cảnh báo thường trú.
 */
function Blockers({
  reasons,
  status,
}: {
  reasons: string[];
  status: EventMasterData['event']['status'];
}) {
  if (reasons.length === 0 || status === 'PUBLISHED') {
    return null;
  }

  return (
    <Panel className={styles.blockers}>
      <TriangleAlert size={18} aria-hidden="true" />
      <div>
        <p className={styles.blockersTitle}>Chưa công bố được</p>
        <ul className={styles.blockersList}>
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

/** Doanh thu từng suất — suất nào gánh tiền, suất nào chưa ai mua. */
function RevenueBySession({ sessions, down }: { sessions: SessionReport[]; down: boolean }) {
  if (down) {
    return <p className={styles.chartEmpty}>Chưa hỏi được doanh thu từ analytics.</p>;
  }

  const rows = sessions
    .filter((session) => session.sales !== null)
    .map((session) => ({
      key: session.eventSessionId,
      label: formatDateTime(session.startsAt),
      value: session.sales?.grossVnd ?? 0,
      hint: `${formatNumber(session.sales?.ticketsSold ?? 0)} vé đã phát hành`,
    }));

  if (rows.length === 0) {
    return <p className={styles.chartEmpty}>Chưa có suất nào bán được vé.</p>;
  }

  return (
    <BarChart
      caption="Doanh thu theo suất diễn"
      rows={rows}
      format={(value) => `${formatNumber(value)}đ`}
    />
  );
}

/**
 * Tỷ lệ lấp đầy theo khu, gộp mọi suất.
 *
 * `max={100}` cố ý: thang đo có nghĩa tuyệt đối, nên một khu bán 30% phải trông đúng 30% chứ không
 * phải "dài nhất trong nhóm". Bỏ `max` đi thì một sự kiện mà khu nào cũng bán chậm sẽ hiện ra như
 * một biểu đồ đầy ắp.
 */
function FillByZone({ sessions, down }: { sessions: SessionReport[]; down: boolean }) {
  const zones = useAggregatedZones(sessions);

  if (down) {
    return <p className={styles.chartEmpty}>Chưa hỏi được trạng thái chỗ từ inventory.</p>;
  }
  if (zones.length === 0) {
    return <p className={styles.chartEmpty}>Suất diễn chưa dựng tồn kho.</p>;
  }

  return (
    <BarChart
      caption="Tỷ lệ lấp đầy theo khu"
      max={100}
      rows={zones.map((zone) => ({
        key: zone.zoneCode,
        label: zone.zoneCode,
        value: zone.total === 0 ? 0 : Math.round((zone.sold / zone.total) * 100),
        hint: `${formatNumber(zone.sold)} / ${formatNumber(zone.total)} chỗ`,
      }))}
      format={(value) => `${value}%`}
    />
  );
}

interface ZoneRollup {
  zoneCode: string;
  admissionType: string;
  available: number;
  held: number;
  sold: number;
  blocked: number;
  total: number;
}

/**
 * Gộp trạng thái chỗ của mọi suất theo khu.
 *
 * Gộp chứ không tách theo suất: ban tổ chức nhìn để biết khu nào bán chậm, và một sự kiện ba suất
 * thì ba bảng cạnh nhau bắt họ tự cộng nhẩm.
 */
function useAggregatedZones(sessions: SessionReport[]): ZoneRollup[] {
  return useMemo(() => {
    const byZone = new Map<string, ZoneRollup>();
    for (const session of sessions) {
      for (const zone of session.seating?.zones ?? []) {
        const current = byZone.get(zone.zoneCode) ?? {
          zoneCode: zone.zoneCode,
          admissionType: zone.admissionType,
          available: 0,
          held: 0,
          sold: 0,
          blocked: 0,
          total: 0,
        };
        current.available += zone.available;
        current.held += zone.held;
        current.sold += zone.sold;
        current.blocked += zone.blocked;
        current.total += zone.total;
        byZone.set(zone.zoneCode, current);
      }
    }
    return [...byZone.values()].sort((a, b) => a.zoneCode.localeCompare(b.zoneCode));
  }, [sessions]);
}

function SessionTable({
  sessions,
  seatingDown,
}: {
  sessions: SessionReport[];
  seatingDown: boolean;
}) {
  return (
    <Table<SessionReport>
      caption="Theo từng suất diễn"
      rows={sessions}
      rowKey={(row) => row.eventSessionId}
      emptyTitle="Sự kiện chưa có suất diễn nào"
      columns={[
        { key: 'startsAt', header: 'Suất diễn', cell: (row) => formatDateTime(row.startsAt) },
        {
          key: 'state',
          header: 'Tồn kho',
          cell: (row) =>
            row.seating === null ? (
              // Hai lý do rất khác nhau cho cùng một ô trống, và ban tổ chức phải phân biệt được:
              // "chưa publish" là việc của họ, "chưa hỏi được" thì không.
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
          key: 'held',
          header: 'Đang giữ',
          numeric: true,
          cell: (row) => (row.seating ? formatNumber(row.seating.totals.held) : '—'),
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
  );
}

/**
 * Khu vực: trạng thái chỗ cộng với cấu hình của khu.
 *
 * Ghép hai nguồn vào một bảng vì chúng trả lời cùng một câu: khu này khai bao nhiêu chỗ, và thực
 * tế đang bán tới đâu. `Chưa đặt vị trí` là thứ chỉ thấy được ở đây — nó không sai, nhưng nghĩa là
 * sơ đồ đang để bố cục tự động xếp khu ấy.
 */
function ZoneTable({ sessions, zones }: { sessions: SessionReport[]; zones: AdminZone[] }) {
  const rollup = useAggregatedZones(sessions);
  const config = useMemo(() => new Map(zones.map((zone) => [zone.zoneCode, zone])), [zones]);

  if (rollup.length === 0) {
    return (
      <Table<AdminZone>
        caption="Khu vực của địa điểm"
        rows={zones}
        rowKey={(row) => row.id}
        emptyTitle="Địa điểm chưa khai khu nào"
        columns={[
          { key: 'zone', header: 'Khu', cell: (row) => `${row.zoneCode} · ${row.name}` },
          {
            key: 'kind',
            header: 'Loại',
            cell: (row) => (row.kind === 'SEATED' ? 'Có ghế' : 'Vé đứng'),
          },
          {
            key: 'seats',
            header: 'Số chỗ',
            numeric: true,
            cell: (row) => formatNumber(row.seatCount),
          },
          {
            key: 'layout',
            header: 'Vị trí mặt bằng',
            cell: (row) =>
              row.layout ? (
                <Badge tone="neutral">{row.layout.shape === 'ARC' ? 'Cung tròn' : 'Khối'}</Badge>
              ) : (
                <span className={styles.subtle}>Chưa đặt</span>
              ),
          },
        ]}
      />
    );
  }

  return (
    <Table<ZoneRollup>
      caption="Theo khu vực"
      rows={rollup}
      rowKey={(row) => row.zoneCode}
      columns={[
        {
          key: 'zone',
          header: 'Khu',
          cell: (row) => {
            const zone = config.get(row.zoneCode);
            return zone ? `${row.zoneCode} · ${zone.name}` : row.zoneCode;
          },
        },
        {
          key: 'kind',
          header: 'Loại',
          cell: (row) => (row.admissionType === 'SEATED' ? 'Có ghế' : 'Vé đứng'),
        },
        { key: 'sold', header: 'Đã bán', numeric: true, cell: (row) => formatNumber(row.sold) },
        { key: 'held', header: 'Đang giữ', numeric: true, cell: (row) => formatNumber(row.held) },
        {
          key: 'available',
          header: 'Còn trống',
          numeric: true,
          cell: (row) => formatNumber(row.available),
        },
        {
          key: 'blocked',
          header: 'Khoá',
          numeric: true,
          cell: (row) => formatNumber(row.blocked),
        },
        {
          key: 'fill',
          header: 'Lấp đầy',
          numeric: true,
          cell: (row) => (row.total === 0 ? '—' : `${Math.round((row.sold / row.total) * 100)}%`),
        },
      ]}
    />
  );
}

interface TicketTypeRow extends AdminTicketType {
  sessionStartsAt: string;
  rowKey: string;
}

/** Giá từng hạng vé của từng suất — cấu hình thương mại, thứ ban tổ chức tự quyết (ADR-1010). */
function TicketTypeTable({ sessions }: { sessions: AdminSession[] }) {
  const rows = useMemo(
    () =>
      sessions.flatMap((session) =>
        session.ticketTypes.map((type) => ({
          ...type,
          sessionStartsAt: session.startsAt,
          rowKey: `${session.id}:${type.id}`,
        })),
      ),
    [sessions],
  );

  return (
    <Table<TicketTypeRow>
      caption="Hạng vé và giá"
      rows={rows}
      rowKey={(row) => row.rowKey}
      emptyTitle="Chưa khai hạng vé nào"
      emptyDescription="Sự kiện không có hạng vé thì không publish được — xem danh sách việc còn thiếu ở trên."
      columns={[
        {
          key: 'session',
          header: 'Suất diễn',
          cell: (row) => formatDateTime(row.sessionStartsAt),
        },
        { key: 'zone', header: 'Khu', cell: (row) => `${row.zoneCode} · ${row.zoneName}` },
        { key: 'name', header: 'Hạng vé', cell: (row) => row.name },
        {
          key: 'price',
          header: 'Giá',
          numeric: true,
          cell: (row) => <MoneyText amountVnd={row.priceVnd} />,
        },
        {
          key: 'capacity',
          header: 'Sức chứa',
          numeric: true,
          cell: (row) => formatNumber(row.capacity),
        },
      ]}
    />
  );
}

/**
 * Trần mua vé của từng suất.
 *
 * Đây là cấu hình chống đầu cơ, và nó chỉ đọc được ở đây: `null` nghĩa là suất này KHÔNG đặt trần,
 * khác hẳn với 0. Một suất bán chạy mà không có trần là chỗ để một người vét sạch khu tốt.
 */
function LimitTable({ sessions }: { sessions: AdminSession[] }) {
  const limit = (value: number | null) =>
    value === null ? <span className={styles.subtle}>Không đặt</span> : formatNumber(value);

  return (
    <Table<AdminSession>
      caption="Trần mua vé theo suất"
      rows={sessions}
      rowKey={(row) => row.id}
      emptyTitle="Sự kiện chưa có suất diễn nào"
      columns={[
        { key: 'session', header: 'Suất diễn', cell: (row) => formatDateTime(row.startsAt) },
        {
          key: 'perCustomer',
          header: 'Mỗi khách',
          numeric: true,
          cell: (row) => limit(row.maxTicketsPerCustomer),
        },
        {
          key: 'seated',
          header: 'Ghế mỗi lần giữ',
          numeric: true,
          cell: (row) => limit(row.maxSeatedPerHold),
        },
        {
          key: 'standing',
          header: 'Vé đứng mỗi lần giữ',
          numeric: true,
          cell: (row) => limit(row.maxStandingPerHold),
        },
        {
          key: 'units',
          header: 'Tổng mỗi lần giữ',
          numeric: true,
          cell: (row) => limit(row.maxUnitsPerHold),
        },
        {
          key: 'sales',
          header: 'Mở bán',
          cell: (row) =>
            row.salesOpenAt ? (
              formatDateTime(row.salesOpenAt)
            ) : (
              <span className={styles.subtle}>Ngay khi publish</span>
            ),
        },
      ]}
    />
  );
}

/**
 * Phân tích: những con số KHÔNG có trong payload, phải suy ra.
 *
 * <h3>Vì sao chúng thuộc về đây chứ không thuộc backend</h3>
 *
 * Cả bốn chỉ số dưới đây là phép chia của những số đã có. Bắt backend trả thêm bốn trường nữa
 * nghĩa là bốn trường phải giữ đồng bộ với tử số và mẫu số của chính chúng, để đổi lấy đúng một
 * phép chia mà client làm trong một dòng. Suy ở đây thì không có gì lệch được.
 *
 * <h3>Mẫu số bằng 0 không được hiện thành 0%</h3>
 *
 * Một sự kiện chưa bán vé nào có `ticketsSold = 0`, và "giá vé trung bình 0đ" là một câu sai. Mọi
 * chỉ số ở đây trả `null` khi mẫu số bằng 0, và `StatCard` vẽ khối chờ thay vì một con số bịa.
 */
function Insights({
  data,
  seatingDown,
  salesDown,
}: {
  data: EventMasterData;
  seatingDown: boolean;
  salesDown: boolean;
}) {
  const zones = useAggregatedZones(data.sessions);
  const { totals } = data;

  const fillRate =
    seatingDown || totals.materializedSeats === 0
      ? null
      : Math.round((totals.seatsSold / totals.materializedSeats) * 100);

  const avgTicketPrice =
    salesDown || totals.ticketsSold === 0 ? null : Math.round(totals.grossVnd / totals.ticketsSold);

  // Giá khai trung bình có TRỌNG SỐ theo sức chứa, không phải trung bình cộng các mức giá: một khu
  // VIP 20 chỗ và một khu thường 2.000 chỗ không đóng góp bằng nhau vào doanh thu kỳ vọng.
  const declared = useMemo(() => {
    let capacity = 0;
    let value = 0;
    for (const session of data.event.sessions) {
      for (const type of session.ticketTypes) {
        capacity += type.capacity;
        value += type.capacity * type.priceVnd;
      }
    }
    return capacity === 0 ? null : { capacity, expected: value, avg: Math.round(value / capacity) };
  }, [data.event.sessions]);

  const slowest = zones.length === 0 ? null : [...zones].sort((a, b) => share(a) - share(b))[0];
  const fastest = zones.length === 0 ? null : [...zones].sort((a, b) => share(b) - share(a))[0];

  return (
    <>
      <StatGrid>
        <StatCard
          label="Tỷ lệ lấp đầy"
          value={fillRate}
          hint={
            seatingDown
              ? 'Chưa hỏi được'
              : totals.materializedSeats === 0
                ? 'Chưa dựng tồn kho'
                : `${formatNumber(totals.seatsSold)} / ${formatNumber(totals.materializedSeats)} chỗ`
          }
        />
        <StatCard
          label="Giá vé trung bình"
          value={avgTicketPrice}
          hint={
            salesDown
              ? 'Chưa hỏi được'
              : totals.ticketsSold === 0
                ? 'Chưa bán được vé nào'
                : 'Thực thu chia số vé'
          }
        />
        <StatCard
          label="Giá khai trung bình"
          value={declared?.avg ?? null}
          hint={declared ? 'Bình quân theo sức chứa từng hạng' : 'Chưa khai hạng vé'}
        />
        {/*
          Doanh thu kỳ vọng nếu bán hết theo giá đã khai. Đặt cạnh doanh thu thực để thấy khoảng
          cách — đây là con số ban tổ chức dùng để quyết định có giảm giá hay không.
        */}
        <StatCard
          label="Doanh thu nếu bán hết"
          value={declared?.expected ?? null}
          hint={declared ? 'Theo giá và sức chứa đã khai' : 'Chưa khai hạng vé'}
        />
      </StatGrid>

      {slowest && fastest && slowest.zoneCode !== fastest.zoneCode ? (
        <Panel>
          <h3 className={styles.blockTitle}>Nhận xét</h3>
          <ul className={styles.notes}>
            <li>
              Bán chậm nhất: <b>{slowest.zoneCode}</b> — {Math.round(share(slowest) * 100)}% (
              {formatNumber(slowest.available)} chỗ còn trống).
            </li>
            <li>
              Bán nhanh nhất: <b>{fastest.zoneCode}</b> — {Math.round(share(fastest) * 100)}%.
            </li>
            {declared && !salesDown && declared.expected > 0 ? (
              <li>
                Đã thu <b>{Math.round((totals.grossVnd / declared.expected) * 100)}%</b> doanh thu
                kỳ vọng nếu bán hết theo giá đã khai.
              </li>
            ) : null}
          </ul>
        </Panel>
      ) : null}
    </>
  );
}

function share(zone: ZoneRollup): number {
  return zone.total === 0 ? 0 : zone.sold / zone.total;
}
