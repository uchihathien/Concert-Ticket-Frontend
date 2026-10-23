// @vitest-environment node
//
// Môi trường node: fetch của undici cần AbortSignal của chính nó (xem client.test.ts).
//
// Hợp đồng HTTP của từng hàm trong `api/*`: đúng method, đúng đường dẫn (đối chiếu với các
// controller ở backend/services/*/interfaces/rest), đúng query string, đúng body, và khoá
// Idempotency-Key ở những chỗ backend bắt buộc. Một chữ sai ở đây là 404 hoặc 400 trên production
// mà type-check không bắt được.
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { fetchOrganizationSales } from '../api/analytics';
import {
  createEvent,
  createSession,
  createTicketType,
  createVenue,
  createZone,
  deleteSession,
  deleteTicketType,
  getEvent,
  listEvents,
  listVenues,
  publishEvent,
  unpublishEvent,
  updateEvent,
  updateSession,
  updateTicketType,
} from '../api/catalog';
import { getEventMasterData, getOrganizationDashboard } from '../api/dashboard';
import { getPublicFloorPlan, getVenueFloorPlan } from '../api/floor-plan';
import {
  acceptInvitation,
  acceptMyInvitation,
  activateOrganization,
  changeMemberRole,
  createOrganization,
  getAuditLogs,
  getMembers,
  getMyOrganizations,
  getMyPendingInvitations,
  getMyPermissions,
  getOrganization,
  getPendingInvitations,
  getPlatformAuditLogs,
  getRoles,
  grantMember,
  inviteMember,
  listPlatformOrganizations,
  removeMember,
  renameOrganization,
  revokeInvitation,
  revokeMemberSessions,
  sendMemberPasswordReset,
  suspendOrganization,
} from '../api/identity';
import { releaseHold } from '../api/inventory';
import { getOrganizationBalance, getTrialBalance } from '../api/ledger';
import { requestPosterUpload, uploadPoster } from '../api/media';
import { cancelOrder, getOrder, listMyOrders, placeOrder } from '../api/ordering';
import { searchOrganizationTickets } from '../api/organization-tickets';
import { getPublicEvent, listPublicEvents, listTrendingEvents } from '../api/public-catalog';
import {
  configureVenueZones,
  getSeatMapImages,
  previewFloorPlan,
  setEventSeatMapImage,
  setVenueSeatMapImage,
} from '../api/seating';
import {
  addKnowledgeChunk,
  askSupport,
  claimHandoff,
  deleteKnowledgeChunk,
  getChatThread,
  getEventRules,
  getHandoffThread,
  listHandoffs,
  listKnowledgeChunks,
  previewKnowledge,
  replyToHandoff,
  requestHumanAgent,
  resolveHandoff,
  saveEventRules,
} from '../api/support';
import {
  listCheckinSessions,
  listMyTickets,
  listOrderTickets,
  scanTicket,
  scanTicketForOrganization,
} from '../api/ticketing';
import { ApiError } from '../http/api-error';
import { createApiClient } from '../http/client';

const BASE_URL = 'http://gateway.test';

interface Seen {
  method: string;
  /** pathname + search, đúng như gateway nhận. */
  url: string;
  body: unknown;
  idempotencyKey: string | null;
  contentType: string | null;
  authorization: string | null;
}

let seen: Seen[] = [];
let reply: { status: number; body: unknown } = { status: 200, body: {} };

const server = setupServer(
  http.all(`${BASE_URL}/*`, async ({ request }) => {
    const url = new URL(request.url);
    const text = await request.text();
    seen.push({
      method: request.method,
      url: url.pathname + url.search,
      body: text === '' ? undefined : JSON.parse(text),
      idempotencyKey: request.headers.get('Idempotency-Key'),
      contentType: request.headers.get('Content-Type'),
      authorization: request.headers.get('Authorization'),
    });
    return reply.status === 204
      ? new HttpResponse(null, { status: 204 })
      : HttpResponse.json(reply.body as Record<string, unknown>, { status: reply.status });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  seen = [];
  reply = { status: 200, body: {} };
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const client = createApiClient({ baseUrl: BASE_URL, getAccessToken: () => 'tok' });

function only(): Seen {
  expect(seen).toHaveLength(1);
  return seen[0]!;
}

describe('ordering — đặt và huỷ đơn', () => {
  it('placeOrder: POST /v1/orders, body nguyên vẹn và BẮT BUỘC kèm Idempotency-Key', async () => {
    reply = {
      status: 201,
      body: {
        orderId: 'o1',
        orderNumber: 'NT1000001',
        totalVnd: 1_200_000,
        paymentReference: 'NT1000001',
        vietQrPayload: '000201...',
        checkoutUrl: null,
        paymentExpiresAt: '2026-11-01T12:15:00Z',
      },
    };

    const created = await placeOrder(client, { holdId: 'h1', promotionCode: 'GIAM10' }, 'idem-1');

    const call = only();
    expect(call.method).toBe('POST');
    expect(call.url).toBe('/v1/orders');
    expect(call.body).toEqual({ holdId: 'h1', promotionCode: 'GIAM10' });
    expect(call.idempotencyKey).toBe('idem-1');
    expect(call.contentType).toBe('application/json');
    expect(call.authorization).toBe('Bearer tok');
    expect(created.orderId).toBe('o1');
  });

  it('getOrder mã hoá orderId — không để một id lạ thành đường dẫn khác', async () => {
    await getOrder(client, 'a/../b');
    expect(only().url).toBe('/v1/orders/a%2F..%2Fb');
  });

  it('listMyOrders: không có tham số thì không có dấu ?, có thì gửi limit/offset (kể cả 0)', async () => {
    reply = { status: 200, body: [] };
    await listMyOrders(client);
    await listMyOrders(client, { limit: 20, offset: 0 });
    expect(seen.map((s) => s.url)).toEqual(['/v1/me/orders', '/v1/me/orders?limit=20&offset=0']);
  });

  it('cancelOrder: POST /v1/orders/{id}/cancel, không body, chịu được 204', async () => {
    reply = { status: 204, body: null };
    await expect(cancelOrder(client, 'o1')).resolves.toBeUndefined();
    const call = only();
    expect(call.method).toBe('POST');
    expect(call.url).toBe('/v1/orders/o1/cancel');
    expect(call.body).toBeUndefined();
    // Không body thì không được khai Content-Type JSON.
    expect(call.contentType).toBeNull();
  });

  it('đơn của người khác → 404 ORDER_NOT_FOUND thành ApiError đọc được', async () => {
    reply = {
      status: 404,
      body: { type: 'about:blank', title: 'Not Found', status: 404, code: 'ORDER_NOT_FOUND' },
    };
    const error = (await getOrder(client, 'o9').catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('ORDER_NOT_FOUND');
    expect(error.status).toBe(404);
  });
});

describe('inventory — nhả chỗ', () => {
  it('releaseHold: DELETE /v1/holds/{id}', async () => {
    reply = { status: 204, body: null };
    await releaseHold(client, 'h1');
    const call = only();
    expect(call.method).toBe('DELETE');
    expect(call.url).toBe('/v1/holds/h1');
  });
});

describe('public catalog', () => {
  it('listPublicEvents: không tham số thì gọi /v1/events trần', async () => {
    reply = { status: 200, body: { items: [], page: 0, size: 20, total: 0 } };
    await listPublicEvents(client);
    expect(only().url).toBe('/v1/events');
  });

  it('listPublicEvents: tên tham số khớp @RequestParam của PublicCatalogController, giá 0 không bị nuốt', async () => {
    reply = { status: 200, body: { items: [] } };
    await listPublicEvents(client, {
      query: 'mỹ tâm',
      city: 'Hà Nội',
      category: 'MUSIC',
      from: '2026-11-01T00:00:00Z',
      to: '2026-11-30T00:00:00Z',
      minPrice: 0,
      maxPrice: 500_000,
      page: 2,
      size: 12,
    });

    const url = new URL(only().url, BASE_URL);
    expect(url.pathname).toBe('/v1/events');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      query: 'mỹ tâm',
      city: 'Hà Nội',
      category: 'MUSIC',
      from: '2026-11-01T00:00:00Z',
      to: '2026-11-30T00:00:00Z',
      minPrice: '0',
      maxPrice: '500000',
      page: '2',
      size: '12',
    });
  });

  it('listPublicEvents: chuỗi rỗng không thành tham số rỗng', async () => {
    reply = { status: 200, body: { items: [] } };
    await listPublicEvents(client, { query: '', city: '' });
    expect(only().url).toBe('/v1/events');
  });

  it('getPublicEvent mã hoá slug', async () => {
    await getPublicEvent(client, 'đêm nhạc/1');
    expect(only().url).toBe(`/v1/events/${encodeURIComponent('đêm nhạc/1')}`);
  });

  it('listTrendingEvents mặc định size=8, nhận size khác', async () => {
    reply = { status: 200, body: [] };
    await listTrendingEvents(client);
    await listTrendingEvents(client, 4);
    expect(seen.map((s) => s.url)).toEqual([
      '/v1/events/trending?size=8',
      '/v1/events/trending?size=4',
    ]);
  });

  it('getPublicFloorPlan và getVenueFloorPlan', async () => {
    await getPublicFloorPlan(client, 'show-a');
    await getVenueFloorPlan(client, 'org1', 'v1');
    expect(seen.map((s) => s.url)).toEqual([
      '/v1/events/show-a/floor-plan',
      '/v1/organizations/org1/venues/v1/floor-plan',
    ]);
  });
});

describe('ticketing', () => {
  it('scanTicket: POST /v1/sessions/{id}/checkins với body nguyên vẹn', async () => {
    reply = { status: 200, body: { result: 'ACCEPTED' } };
    await scanTicket(client, 's1', { qrToken: 'qr' } as never);
    const call = only();
    expect(call.method).toBe('POST');
    expect(call.url).toBe('/v1/sessions/s1/checkins');
    expect(call.body).toEqual({ qrToken: 'qr' });
  });

  it('scanTicketForOrganization và listCheckinSessions dùng đường dẫn theo tổ chức', async () => {
    reply = { status: 200, body: [] };
    await listCheckinSessions(client, 'org 1');
    await scanTicketForOrganization(client, 'org1', 's1', { qrToken: 'qr' } as never);
    expect(seen.map((s) => `${s.method} ${s.url}`)).toEqual([
      'GET /v1/organizations/org%201/checkin-sessions',
      'POST /v1/organizations/org1/sessions/s1/checkins',
    ]);
  });

  it('listMyTickets / listOrderTickets', async () => {
    reply = { status: 200, body: [] };
    await listMyTickets(client);
    await listMyTickets(client, { limit: 50, offset: 100 });
    await listOrderTickets(client, 'o1');
    expect(seen.map((s) => s.url)).toEqual([
      '/v1/me/tickets',
      '/v1/me/tickets?limit=50&offset=100',
      '/v1/orders/o1/tickets',
    ]);
  });

  it('searchOrganizationTickets: chỉ gửi tiêu chí có giá trị', async () => {
    reply = { status: 200, body: { items: [] } };
    await searchOrganizationTickets(client, 'org1');
    await searchOrganizationTickets(client, 'org1', {
      eventSessionId: 's1',
      query: 'lan',
      zoneCode: 'A',
      status: 'ISSUED',
      paymentStatus: 'PAID',
      page: 0,
      size: 25,
    } as never);
    expect(seen[0]!.url).toBe('/v1/organizations/org1/tickets');
    const url = new URL(seen[1]!.url, BASE_URL);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      eventSessionId: 's1',
      query: 'lan',
      zoneCode: 'A',
      status: 'ISSUED',
      paymentStatus: 'PAID',
      page: '0',
      size: '25',
    });
  });
});

describe('catalog quản trị', () => {
  it('đi đúng method + đường dẫn cho từng thao tác', async () => {
    await listVenues(client, 'org1');
    await createVenue(client, 'org1', { name: 'Nhà hát' } as never, 'k-venue');
    await createZone(client, 'org1', 'v1', { code: 'A' } as never, 'k-zone');
    await listEvents(client, 'org1');
    await getEvent(client, 'org1', 'e1');
    await createEvent(client, 'org1', { title: 'Show' } as never, 'k-event');
    await updateEvent(client, 'org1', 'e1', { title: 'Show 2' } as never);
    await createSession(client, 'org1', 'e1', { startsAt: 'x' } as never, 'k-session');
    await createTicketType(client, 'org1', 'e1', 's1', { name: 'VIP' } as never, 'k-tt');
    await updateSession(client, 'org1', 'e1', 's1', { startsAt: 'y' } as never);
    await deleteSession(client, 'org1', 'e1', 's1');
    await updateTicketType(client, 'org1', 'e1', 's1', 't1', { priceVnd: 1 } as never);
    await deleteTicketType(client, 'org1', 'e1', 's1', 't1');
    await publishEvent(client, 'org1', 'e1');
    await unpublishEvent(client, 'org1', 'e1');

    expect(seen.map((s) => `${s.method} ${s.url}`)).toEqual([
      'GET /v1/organizations/org1/venues',
      'POST /v1/organizations/org1/venues',
      'POST /v1/organizations/org1/venues/v1/zones',
      'GET /v1/organizations/org1/events',
      'GET /v1/organizations/org1/events/e1',
      'POST /v1/organizations/org1/events',
      'PATCH /v1/organizations/org1/events/e1',
      'POST /v1/organizations/org1/events/e1/sessions',
      'POST /v1/organizations/org1/events/e1/sessions/s1/ticket-types',
      'PATCH /v1/organizations/org1/events/e1/sessions/s1',
      'DELETE /v1/organizations/org1/events/e1/sessions/s1',
      'PATCH /v1/organizations/org1/events/e1/sessions/s1/ticket-types/t1',
      'DELETE /v1/organizations/org1/events/e1/sessions/s1/ticket-types/t1',
      'POST /v1/organizations/org1/events/e1/publish',
      'POST /v1/organizations/org1/events/e1/unpublish',
    ]);
    // Khoá chống trùng đi theo đúng lệnh tạo đã nhận nó; lệnh sửa/xoá không mang khoá.
    expect(seen.map((s) => s.idempotencyKey)).toEqual([
      null,
      'k-venue',
      'k-zone',
      null,
      null,
      'k-event',
      null,
      'k-session',
      'k-tt',
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(seen[6]!.body).toEqual({ title: 'Show 2' });
  });

  it('seating: PUT zones, POST preview, ảnh sơ đồ', async () => {
    reply = { status: 200, body: {} };
    await configureVenueZones(client, 'org1', 'v1', { zones: [] } as never);
    await previewFloorPlan(client, 'org1', 'v1', { zones: [] } as never);
    await getSeatMapImages(client, 'org1', 'e1');
    await setEventSeatMapImage(client, 'org1', 'e1', '');
    await setVenueSeatMapImage(client, 'org1', 'v1', 'https://cdn/x.png');
    expect(seen.map((s) => `${s.method} ${s.url}`)).toEqual([
      'PUT /v1/organizations/org1/venues/v1/zones',
      'POST /v1/organizations/org1/venues/v1/floor-plan/preview',
      'GET /v1/organizations/org1/events/e1/seat-map-image',
      'PUT /v1/organizations/org1/events/e1/seat-map-image',
      'PUT /v1/organizations/org1/venues/v1/seat-map-image',
    ]);
    // Chuỗi rỗng là "gỡ ảnh" — phải đi lên nguyên vẹn, không bị bỏ trường.
    expect(seen[3]!.body).toEqual({ imageUrl: '' });
    expect(seen[4]!.body).toEqual({ imageUrl: 'https://cdn/x.png' });
  });

  it('dashboard, analytics, ledger', async () => {
    await getOrganizationDashboard(client, 'org1');
    await getEventMasterData(client, 'org1', 'e1');
    await fetchOrganizationSales(client, 'org/1');
    await getTrialBalance(client);
    await getOrganizationBalance(client, 'org1');
    expect(seen.map((s) => s.url)).toEqual([
      '/v1/organizations/org1/dashboard',
      '/v1/organizations/org1/events/e1/master-data',
      '/v1/admin/organizations/org%2F1/sales',
      '/v1/platform/trial-balance',
      '/v1/platform/organizations/org1/balance',
    ]);
  });
});

describe('identity', () => {
  it('đường dẫn của thành viên, lời mời và tổ chức', async () => {
    reply = { status: 200, body: [] };
    await getMyOrganizations(client);
    await getMyPendingInvitations(client);
    await acceptMyInvitation(client, 'inv 1');
    await getOrganization(client, 'org1');
    await getMembers(client, 'org1');
    await inviteMember(client, 'org1', { email: 'a@b.vn', role: 'STAFF' } as never, 'k-inv');
    await acceptInvitation(client, 'tok/en');
    await createOrganization(client, { name: 'BTC' } as never, 'k-org');
    await getRoles(client);
    await getMyPermissions(client);
    await renameOrganization(client, 'org1', 'Tên mới');
    await changeMemberRole(client, 'org1', 'u1', 'ADMIN' as never);
    await removeMember(client, 'org1', 'u1');
    await sendMemberPasswordReset(client, 'org1', 'u1');
    await getPendingInvitations(client, 'org1');
    await revokeInvitation(client, 'org1', 'i1');
    await grantMember(client, 'org1', { email: 'x@y.vn' } as never, 'k-grant');
    await suspendOrganization(client, 'org1');
    await activateOrganization(client, 'org1');

    expect(seen.map((s) => `${s.method} ${s.url}`)).toEqual([
      'GET /v1/me/organizations',
      'GET /v1/me/invitations',
      'POST /v1/me/invitations/inv%201/accept',
      'GET /v1/organizations/org1',
      'GET /v1/organizations/org1/members',
      'POST /v1/organizations/org1/invitations',
      'POST /v1/invitations/tok%2Fen/accept',
      'POST /v1/platform/organizations',
      'GET /v1/roles',
      'GET /v1/me/permissions',
      'PATCH /v1/organizations/org1',
      'PATCH /v1/organizations/org1/members/u1',
      'DELETE /v1/organizations/org1/members/u1',
      'POST /v1/organizations/org1/members/u1/password-reset',
      'GET /v1/organizations/org1/invitations',
      'DELETE /v1/organizations/org1/invitations/i1',
      'POST /v1/platform/organizations/org1/members',
      'POST /v1/platform/organizations/org1/suspend',
      'POST /v1/platform/organizations/org1/activate',
    ]);
    expect(seen[5]!.idempotencyKey).toBe('k-inv');
    expect(seen[7]!.idempotencyKey).toBe('k-org');
    expect(seen[16]!.idempotencyKey).toBe('k-grant');
    expect(seen[10]!.body).toEqual({ name: 'Tên mới' });
    expect(seen[11]!.body).toEqual({ role: 'ADMIN' });
  });

  it('listPlatformOrganizations và nhật ký kiểm toán có trang mặc định 50/0', async () => {
    reply = { status: 200, body: [] };
    await listPlatformOrganizations(client);
    await getAuditLogs(client, 'org1');
    await getAuditLogs(client, 'org1', {
      action: 'MEMBER_REMOVED',
      from: '2026-10-01T00:00:00Z',
      to: '2026-10-31T00:00:00Z',
      limit: 10,
      offset: 20,
    });
    await getPlatformAuditLogs(client, { limit: 5 });

    expect(seen[0]!.url).toBe('/v1/platform/organizations?limit=50&offset=0');
    expect(seen[1]!.url).toBe('/v1/organizations/org1/audit-logs?limit=50&offset=0');
    const filtered = new URL(seen[2]!.url, BASE_URL);
    expect(Object.fromEntries(filtered.searchParams)).toEqual({
      limit: '10',
      offset: '20',
      action: 'MEMBER_REMOVED',
      from: '2026-10-01T00:00:00Z',
      to: '2026-10-31T00:00:00Z',
    });
    expect(seen[3]!.url).toBe('/v1/platform/audit-logs?limit=5&offset=0');
  });

  it('revokeMemberSessions: lý do đi trên query string và được mã hoá', async () => {
    reply = { status: 204, body: null };
    await revokeMemberSessions(client, 'org1', 'u1');
    await revokeMemberSessions(client, 'org1', 'u1', 'mất máy & đổi mật khẩu');
    expect(seen.map((s) => `${s.method} ${s.url}`)).toEqual([
      'DELETE /v1/organizations/org1/members/u1/sessions',
      `DELETE /v1/organizations/org1/members/u1/sessions?reason=${encodeURIComponent('mất máy & đổi mật khẩu')}`,
    ]);
  });
});

describe('support', () => {
  it('askSupport kèm Idempotency-Key; các thao tác phiếu chuyển tiếp đi đúng đường', async () => {
    reply = { status: 200, body: { sessionId: 'cs1' } };
    await askSupport(client, { message: 'hoàn vé?' } as never, 'k-ask');
    await getChatThread(client, 'cs1');
    await requestHumanAgent(client, 'cs1');
    await getHandoffThread(client, 'h1');
    await claimHandoff(client, 'h1');
    await replyToHandoff(client, 'h1', 'Chào chị');
    await resolveHandoff(client, 'h1');
    await addKnowledgeChunk(client, { title: 'T', content: 'C' });
    await deleteKnowledgeChunk(client, 'k1');
    await getEventRules(client, 'e1');
    await saveEventRules(client, 'e1', {
      eventTitle: 'Show',
      content: 'Không hoàn',
      refundAllowed: false,
      refundWindowHours: 0,
      published: true,
    });

    expect(seen.map((s) => `${s.method} ${s.url}`)).toEqual([
      'POST /v1/chat/agent/support',
      'GET /v1/chat/agent/sessions/cs1/messages',
      'POST /v1/chat/agent/sessions/cs1/handoff',
      'GET /v1/support/handoffs/h1',
      'POST /v1/support/handoffs/h1/claim',
      'POST /v1/support/handoffs/h1/messages',
      'POST /v1/support/handoffs/h1/resolve',
      'POST /v1/support/knowledge/chunks',
      'DELETE /v1/support/knowledge/chunks/k1',
      'GET /v1/support/knowledge/rules/e1',
      'PUT /v1/support/knowledge/rules/e1',
    ]);
    expect(seen[0]!.idempotencyKey).toBe('k-ask');
    expect(seen[5]!.body).toEqual({ text: 'Chào chị' });
    expect(seen[10]!.body).toMatchObject({ refundAllowed: false, refundWindowHours: 0 });
  });

  it('thẻ CHOICES và thẻ PAYMENT có dòng vé + trạng thái đi nguyên vẹn qua client', async () => {
    const chip = { label: 'VIP', value: 'Hạng VIP', hint: '1.800.000đ · còn 12 chỗ' };
    reply = {
      status: 200,
      body: {
        sessionId: 'cs1',
        answer: 'Bạn chọn hạng vé nào?',
        toolsUsed: [],
        action: { kind: 'CHOICES', step: 'ZONE', prompt: 'Bạn chọn hạng vé nào?', options: [chip] },
      },
    };
    const asked = await askSupport(client, { message: 'cho mình 2 vé đêm nhạc Trịnh' }, 'k-chip');
    expect(asked.action?.kind).toBe('CHOICES');
    if (asked.action?.kind === 'CHOICES') {
      expect(asked.action.step).toBe('ZONE');
      expect(asked.action.options).toEqual([chip]);
    }

    reply = {
      status: 200,
      body: {
        sessionId: 'cs1',
        handoff: null,
        messages: [],
        action: {
          kind: 'PAYMENT',
          orderId: 'o1',
          orderNumber: 'NT-1',
          totalVnd: 3_600_000,
          vietQrPayload: null,
          paymentReference: null,
          checkoutUrl: 'https://pay',
          paymentExpiresAt: '2026-10-23T10:15:00Z',
          eventTitle: 'Đêm nhạc Trịnh',
          eventSlug: 'dem-nhac-trinh',
          lines: [{ zoneName: 'VIP', quantity: 2, unitPriceVnd: 1_800_000 }],
          status: 'PAID',
        },
      },
    };
    const thread = await getChatThread(client, 'cs1');
    expect(thread.action?.kind).toBe('PAYMENT');
    if (thread.action?.kind === 'PAYMENT') {
      expect(thread.action.status).toBe('PAID');
      expect(thread.action.lines).toEqual([{ zoneName: 'VIP', quantity: 2, unitPriceVnd: 1_800_000 }]);
    }
  });

  it('listHandoffs: cắt khoảng trắng ở q, bỏ q chỉ có khoảng trắng, mine=false không gửi', async () => {
    reply = { status: 200, body: [] };
    await listHandoffs(client);
    await listHandoffs(client, { q: '   ', mine: false });
    await listHandoffs(client, {
      mine: true,
      status: 'OPEN',
      intent: 'REFUND' as never,
      q: '  vé hỏng ',
      page: 0,
      size: 10,
    });
    expect(seen[0]!.url).toBe('/v1/support/handoffs');
    expect(seen[1]!.url).toBe('/v1/support/handoffs');
    const url = new URL(seen[2]!.url, BASE_URL);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      mine: 'true',
      status: 'OPEN',
      intent: 'REFUND',
      q: 'vé hỏng',
      page: '0',
      size: '10',
    });
  });

  it('listKnowledgeChunks và previewKnowledge mã hoá câu hỏi', async () => {
    reply = { status: 200, body: [] };
    await listKnowledgeChunks(client);
    await listKnowledgeChunks(client, { eventId: 'e1', page: 1, size: 5 });
    await previewKnowledge(client, 'hoàn vé & đổi suất?');
    expect(seen.map((s) => s.url)).toEqual([
      '/v1/support/knowledge/chunks',
      '/v1/support/knowledge/chunks?eventId=e1&page=1&size=5',
      `/v1/support/knowledge/preview?q=${encodeURIComponent('hoàn vé & đổi suất?')}`,
    ]);
  });
});

describe('media — tải ảnh bìa', () => {
  it('requestPosterUpload: POST kèm contentType', async () => {
    reply = {
      status: 200,
      body: { uploadUrl: 'http://s3.test/put', publicUrl: 'http://cdn/x', contentType: 'image/png' },
    };
    await requestPosterUpload(client, 'org1', 'image/png');
    const call = only();
    expect(call.url).toBe('/v1/organizations/org1/uploads/poster');
    expect(call.body).toEqual({ contentType: 'image/png' });
  });

  it('uploadPoster PUT thẳng vào URL đã ký, KHÔNG gắn Authorization của gateway', async () => {
    let auth: string | null = 'chưa gọi';
    let type: string | null = null;
    server.use(
      http.put('http://s3.test/put', ({ request }) => {
        auth = request.headers.get('Authorization');
        type = request.headers.get('Content-Type');
        return new HttpResponse(null, { status: 200 });
      }),
    );
    const file = new File(['png'], 'a.png', { type: 'image/png' });
    const url = await uploadPoster(
      { uploadUrl: 'http://s3.test/put', publicUrl: 'http://cdn/x', contentType: 'image/png' } as never,
      file,
    );
    expect(url).toBe('http://cdn/x');
    expect(auth).toBeNull();
    expect(type).toBe('image/png');
  });

  it('uploadPoster ném lỗi có mã HTTP khi kho từ chối chữ ký', async () => {
    server.use(http.put('http://s3.test/put', () => new HttpResponse(null, { status: 403 })));
    await expect(
      uploadPoster(
        { uploadUrl: 'http://s3.test/put', publicUrl: 'x', contentType: 'image/png' } as never,
        new File(['x'], 'a.png'),
      ),
    ).rejects.toThrow('403');
  });
});
