import type { EventMasterData, OrganizationSummary } from '@nexaticket/ts-sdk';

/** Dữ liệu mẫu của một sự kiện, dùng chung cho test báo cáo và test màn hình. */
export const ORG: OrganizationSummary = {
  id: 'org-1',
  slug: 'btc',
  name: 'Ban tổ chức Hạ',
  status: 'ACTIVE',
  memberCount: 3,
} as OrganizationSummary;

export function masterData(overrides: Partial<EventMasterData> = {}): EventMasterData {
  return {
    event: {
      id: 'e1',
      slug: 'dem-nhac-ha',
      title: 'Đêm nhạc Hạ',
      summary: null,
      description: null,
      category: 'nhac-song',
      posterUrl: null,
      status: 'PUBLISHED',
      publishedAt: '2026-05-01T03:00:00Z',
      venue: {
        id: 'v1',
        name: 'Nhà hát Lớn',
        city: 'Hà Nội',
        address: null,
        capacity: 600,
        stage: null,
        zones: [
          {
            id: 'z1',
            zoneCode: 'A',
            name: 'Khu A',
            kind: 'SEATED',
            rowCount: 10,
            seatsPerRow: 20,
            capacity: null,
            seatCount: 200,
            layout: null,
          },
          {
            id: 'z2',
            zoneCode: 'SAN',
            name: 'Khu đứng',
            kind: 'STANDING',
            rowCount: null,
            seatsPerRow: null,
            capacity: 400,
            seatCount: 400,
            layout: null,
          },
        ],
      },
      sessions: [
        {
          id: 's1',
          // 13:00Z = 20:00 giờ Việt Nam.
          startsAt: '2026-06-14T13:00:00Z',
          endsAt: null,
          salesOpenAt: null,
          salesCloseAt: null,
          maxSeatedPerHold: 4,
          maxStandingPerHold: null,
          maxUnitsPerHold: null,
          maxTicketsPerCustomer: 8,
          ticketTypes: [
            {
              id: 't1',
              venueZoneId: 'z1',
              zoneCode: 'A',
              zoneName: 'Khu A',
              name: 'Hạng A',
              priceVnd: 1_200_000,
              capacity: 200,
            },
          ],
        },
      ],
      blockers: [],
    },
    sessions: [
      {
        eventSessionId: 's1',
        startsAt: '2026-06-14T13:00:00Z',
        seating: {
          availabilityVersion: 3,
          totals: { available: 150, held: 2, reserved: 0, sold: 48, blocked: 0, total: 200 },
          zones: [
            {
              zoneCode: 'SAN',
              admissionType: 'STANDING',
              available: 0,
              held: 0,
              reserved: 0,
              sold: 0,
              blocked: 0,
              total: 0,
            },
            {
              zoneCode: 'A',
              admissionType: 'SEATED',
              available: 150,
              held: 2,
              reserved: 0,
              sold: 48,
              blocked: 0,
              total: 200,
            },
          ],
        },
        sales: {
          ticketsSold: 48,
          grossVnd: 57_600_000,
          ordersPaid: 20,
          ordersExpired: 1,
          ordersCancelled: 0,
        },
      },
    ],
    totals: {
      declaredCapacity: 600,
      materializedSeats: 200,
      seatsAvailable: 150,
      seatsSold: 48,
      ticketsSold: 48,
      grossVnd: 57_600_000,
    },
    degraded: [],
    ...overrides,
  };
}
