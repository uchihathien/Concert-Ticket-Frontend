import type { EventMasterData, OrganizationSummary } from '@nexaticket/ts-sdk';
import { eventCategoryLabel, type CsvSection } from '@nexaticket/ui';

/**
 * Dựng báo cáo đầy đủ của một sự kiện thành các khối CSV.
 *
 * <h3>Xuất đúng những gì màn hình đang hiện, không nhiều hơn</h3>
 *
 * Báo cáo lấy dữ liệu từ chính `EventMasterData` mà màn hình đang vẽ — không gọi thêm endpoint nào.
 * Nhờ vậy file tải về và màn hình không thể nói hai chuyện khác nhau, kể cả khi một service phía sau
 * vừa im lặng.
 *
 * <h3>Số liệu thiếu ghi là "chưa hỏi được", không ghi 0</h3>
 *
 * Đây là nguyên tắc của cả màn hình, và trong một file mang đi thì nó còn quan trọng hơn: người mở
 * file không thấy dải cảnh báo màu vàng ở đầu trang, nên chữ trong ô là thứ duy nhất nói ra rằng
 * con số ấy chưa có. Một ô "0" trong báo cáo gửi cho kế toán là một câu nói sai về tiền.
 */
export function buildEventReport(
  data: EventMasterData,
  organization: OrganizationSummary,
  exportedAt = new Date(),
): CsvSection[] {
  const seatingDown = data.degraded.some((service) => service.includes('inventory'));
  const salesDown = data.degraded.some((service) => service.includes('analytics'));
  const unknown = 'chưa hỏi được';

  const { event, totals } = data;

  const sections: CsvSection[] = [
    {
      title: 'BÁO CÁO SỰ KIỆN',
      headers: ['Mục', 'Giá trị'],
      rows: [
        ['Tổ chức', organization.name],
        ['Sự kiện', event.title],
        ['Đường dẫn', `/${event.slug}`],
        ['Phân loại', eventCategoryLabel(event.category)],
        ['Trạng thái', statusLabel(event.status)],
        ['Công bố lúc', event.publishedAt ? isoLocal(event.publishedAt) : 'chưa công bố'],
        ['Địa điểm', `${event.venue.name} · ${event.venue.city}`],
        ['Địa chỉ', event.venue.address ?? ''],
        ['Sức chứa địa điểm', event.venue.capacity],
        ['Số khu', event.venue.zones.length],
        ['Số suất diễn', event.sessions.length],
        ['Xuất lúc', isoLocal(exportedAt.toISOString())],
        // Ghi thẳng vào file: người đọc báo cáo phải biết con số nào trong đây chưa đầy đủ, và họ
        // không có dải cảnh báo trên màn hình để mà nhìn.
        ['Số liệu chưa hỏi được', data.degraded.length === 0 ? 'không' : data.degraded.join(' · ')],
      ],
    },
    {
      title: 'TỔNG HỢP',
      headers: ['Chỉ số', 'Giá trị'],
      rows: [
        ['Sức chứa đã khai', totals.declaredCapacity],
        ['Chỗ đã dựng ở tồn kho', seatingDown ? unknown : totals.materializedSeats],
        ['Chỗ đã bán', seatingDown ? unknown : totals.seatsSold],
        ['Vé đã phát hành', salesDown ? unknown : totals.ticketsSold],
        ['Doanh thu (VND, khách trả)', salesDown ? unknown : totals.grossVnd],
        [
          'Tỷ lệ lấp đầy (%)',
          seatingDown || totals.materializedSeats === 0
            ? unknown
            : Math.round((totals.seatsSold / totals.materializedSeats) * 100),
        ],
        [
          'Giá vé trung bình (VND)',
          salesDown || totals.ticketsSold === 0
            ? unknown
            : Math.round(totals.grossVnd / totals.ticketsSold),
        ],
      ],
    },
    {
      title: 'THEO SUẤT DIỄN',
      headers: [
        'Bắt đầu',
        'Tồn kho',
        'Còn trống',
        'Đang giữ',
        'Đã bán',
        'Khoá',
        'Tổng chỗ',
        'Vé phát hành',
        'Doanh thu (VND)',
      ],
      rows: data.sessions.map((session) => [
        isoLocal(session.startsAt),
        session.seating === null ? (seatingDown ? unknown : 'chưa dựng') : 'đang bán',
        session.seating?.totals.available ?? unknown,
        session.seating?.totals.held ?? unknown,
        session.seating?.totals.sold ?? unknown,
        session.seating?.totals.blocked ?? unknown,
        session.seating?.totals.total ?? unknown,
        session.sales?.ticketsSold ?? unknown,
        session.sales?.grossVnd ?? unknown,
      ]),
    },
    {
      title: 'THEO KHU VỰC (gộp mọi suất)',
      headers: [
        'Khu',
        'Loại',
        'Còn trống',
        'Đang giữ',
        'Đã bán',
        'Khoá',
        'Tổng chỗ',
        'Lấp đầy (%)',
      ],
      rows: rollupZones(data).map((zone) => [
        zone.zoneCode,
        zone.admissionType === 'SEATED' ? 'có ghế' : 'vé đứng',
        zone.available,
        zone.held,
        zone.sold,
        zone.blocked,
        zone.total,
        zone.total === 0 ? '' : Math.round((zone.sold / zone.total) * 100),
      ]),
    },
    {
      title: 'HẠNG VÉ VÀ GIÁ',
      headers: ['Suất diễn', 'Khu', 'Tên khu', 'Hạng vé', 'Giá (VND)', 'Sức chứa'],
      rows: event.sessions.flatMap((session) =>
        session.ticketTypes.map((type) => [
          isoLocal(session.startsAt),
          type.zoneCode,
          type.zoneName,
          type.name,
          type.priceVnd,
          type.capacity,
        ]),
      ),
    },
    {
      title: 'TRẦN MUA VÉ THEO SUẤT',
      headers: [
        'Suất diễn',
        'Mỗi khách',
        'Ghế mỗi lần giữ',
        'Vé đứng mỗi lần giữ',
        'Tổng mỗi lần giữ',
        'Mở bán',
        'Đóng bán',
      ],
      // `null` ghi là "không đặt", KHÔNG để trống: ô trống trong báo cáo đọc thành "thiếu dữ liệu",
      // còn ở đây nó là một quyết định — suất này cố ý không có trần.
      rows: event.sessions.map((session) => [
        isoLocal(session.startsAt),
        session.maxTicketsPerCustomer ?? 'không đặt',
        session.maxSeatedPerHold ?? 'không đặt',
        session.maxStandingPerHold ?? 'không đặt',
        session.maxUnitsPerHold ?? 'không đặt',
        session.salesOpenAt ? isoLocal(session.salesOpenAt) : 'ngay khi công bố',
        session.salesCloseAt ? isoLocal(session.salesCloseAt) : 'tới giờ diễn',
      ]),
    },
    {
      title: 'KHU VỰC CỦA ĐỊA ĐIỂM (cấu hình)',
      headers: [
        'Khu',
        'Tên',
        'Loại',
        'Số hàng',
        'Ghế mỗi hàng',
        'Sức chứa khai',
        'Số chỗ',
        'Vị trí mặt bằng',
      ],
      rows: event.venue.zones.map((zone) => [
        zone.zoneCode,
        zone.name,
        zone.kind === 'SEATED' ? 'có ghế' : 'vé đứng',
        zone.rowCount ?? '',
        zone.seatsPerRow ?? '',
        zone.capacity ?? '',
        zone.seatCount,
        zone.layout ? (zone.layout.shape === 'ARC' ? 'cung tròn' : 'khối') : 'chưa đặt',
      ]),
    },
  ];

  if (event.blockers.length > 0) {
    sections.push({
      title: 'CÒN THIẾU ĐỂ CÔNG BỐ',
      headers: ['Việc phải làm'],
      rows: event.blockers.map((reason) => [reason]),
    });
  }

  return sections;
}

function statusLabel(status: EventMasterData['event']['status']): string {
  if (status === 'PUBLISHED') return 'đang bán';
  if (status === 'CANCELLED') return 'đã huỷ';
  if (status === 'UNPUBLISHED') return 'đã rút xuống';
  return 'nháp';
}

/**
 * Mốc thời gian theo giờ địa phương, dạng `2026-06-14 20:00`.
 *
 * KHÔNG dùng ISO có chữ `Z`: người mở báo cáo đọc giờ diễn theo giờ Việt Nam, và một cột ghi
 * `13:00Z` cho suất 20:00 sẽ bị đọc sai mà không ai nghi ngờ gì. Cũng không dùng
 * `toLocaleString` mặc định: định dạng của nó đổi theo máy, nên hai người xuất cùng một báo cáo
 * nhận về hai file khác nhau.
 */
function isoLocal(value: string): string {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}`
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

function rollupZones(data: EventMasterData): ZoneRollup[] {
  const byZone = new Map<string, ZoneRollup>();
  for (const session of data.sessions) {
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
}
