/* global process, Buffer, URL, URLSearchParams, console -- script Node chạy ngoài app */
// Máy chủ giả cho E2E: api-gateway + một nhà cung cấp OIDC tối thiểu, bằng Node `http` trần.
//
// Vì sao có cả OIDC: mọi trang cần đăng nhập của web-customer đi qua Auth.js với provider Keycloak.
// Thay vì tiêm một cookie phiên giả (app không có đường nào như thế), máy chủ này đóng vai issuer
// thật: discovery, /auth (tự đồng ý và chuyển ngay về callback), /token (cấp id_token ký RS256),
// /certs. Auth.js của app chạy NGUYÊN luồng Authorization Code + PKCE như với Keycloak — chỉ đổi
// KEYCLOAK_ISSUER. Không có mật khẩu nào đi qua đây.
//
// Hình dạng JSON lấy theo kiểu của @nexaticket/ts-sdk (types/*.ts) — chính là hợp đồng mà SDK đã
// đối chiếu với backend. Dữ liệu cố định nằm trong ./fixtures/*.json; trạng thái đổi được (giữ chỗ,
// đơn mới, huỷ, trả tiền) sống trong bộ nhớ và về lại ban đầu bằng POST /__reset.
//
// Biến môi trường: STUB_PORT (bắt buộc), WEB_ORIGIN (origin của app, để kiểm redirect_uri).
import { createHash, createSign, generateKeyPairSync, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => JSON.parse(readFileSync(join(here, 'fixtures', name), 'utf8'));

const PORT = Number(process.env.STUB_PORT);
if (!PORT) throw new Error('STUB_PORT chưa đặt');
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? '';
const ORIGIN = `http://127.0.0.1:${PORT}`;
const ISSUER = `${ORIGIN}/realms/nexaticket`;
const OIDC = `/realms/nexaticket/protocol/openid-connect`;

const USER = {
  sub: 'e2e-user-1',
  email: 'khach.e2e@example.test',
  name: 'Khách E2E',
  preferred_username: 'khach.e2e',
};

// ---------------------------------------------------------------------------------------------
// Trạng thái
// ---------------------------------------------------------------------------------------------

let state;
function reset() {
  state = {
    events: fixture('events.json'),
    seatMaps: fixture('seat-maps.json'),
    orders: fixture('orders.json'),
    tickets: fixture('tickets.json'),
    holds: new Map(),
    holdKeys: new Map(),
    orderKeys: new Map(),
    codes: new Map(),
    accessTokens: new Set(),
    refreshTokens: new Set(),
    requests: [],
    orderSeq: 1000100,
  };
}
reset();

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const KID = 'e2e-key-1';
const JWK = { ...publicKey.export({ format: 'jwk' }), kid: KID, alg: 'RS256', use: 'sig' };

const b64url = (input) => Buffer.from(input).toString('base64url');
function signJwt(claims) {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: KID }));
  const payload = b64url(JSON.stringify(claims));
  const signature = createSign('RSA-SHA256').update(`${header}.${payload}`).sign(privateKey);
  return `${header}.${payload}.${signature.toString('base64url')}`;
}

// ---------------------------------------------------------------------------------------------
// Tiện ích HTTP
// ---------------------------------------------------------------------------------------------

const CORS = {
  // Trình duyệt gọi thẳng gateway (NEXT_PUBLIC_API_BASE_URL) với `credentials: 'omit'`, nên `*` đủ.
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization,Content-Type,Idempotency-Key,If-None-Match,Accept',
  'Access-Control-Expose-Headers': 'ETag,X-Correlation-Id',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    ...CORS,
    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    ...headers,
  });
  res.end(body === undefined ? undefined : JSON.stringify(body));
}

/** Lỗi đúng dạng RFC 7807 + `code` của platform/starter-web. */
function problem(res, status, code, detail) {
  send(res, status, {
    type: 'about:blank',
    title: code,
    status,
    code,
    detail,
    correlationId: randomUUID(),
  });
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

const bearer = (req) => (req.headers.authorization ?? '').replace(/^Bearer /, '') || null;
const authed = (req) => {
  const token = bearer(req);
  return token !== null && state.accessTokens.has(token);
};

// ---------------------------------------------------------------------------------------------
// Catalog công khai
// ---------------------------------------------------------------------------------------------

const minPrice = (session) =>
  session.tiers.length === 0 ? null : Math.min(...session.tiers.map((t) => t.priceVnd));

function toCard(event) {
  const prices = event.sessions.map(minPrice).filter((p) => p !== null);
  const next = event.sessions
    .map((s) => s.startsAt)
    .filter((at) => Date.parse(at) > Date.now())
    .sort()[0];
  return {
    slug: event.slug,
    title: event.title,
    summary: event.summary,
    category: event.category,
    posterUrl: event.posterUrl,
    city: event.city,
    venueName: event.venueName,
    nextSessionAt: next ?? null,
    fromPriceVnd: prices.length > 0 ? Math.min(...prices) : null,
    sessionCount: event.sessions.length,
  };
}

const fold = (text) =>
  (text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();

/** Lọc như PublicCatalogController: cùng tên tham số, giá so với giá thấp nhất, `to` không lấy mốc. */
function listEvents(query) {
  let cards = state.events.map(toCard);
  const q = query.get('query');
  if (q) {
    const needle = fold(q);
    cards = cards.filter((c) => fold(`${c.title} ${c.venueName} ${c.city}`).includes(needle));
  }
  if (query.get('city')) cards = cards.filter((c) => c.city === query.get('city'));
  if (query.get('category')) cards = cards.filter((c) => c.category === query.get('category'));
  if (query.get('from')) {
    const from = Date.parse(query.get('from'));
    cards = cards.filter((c) => c.nextSessionAt && Date.parse(c.nextSessionAt) >= from);
  }
  if (query.get('to')) {
    const to = Date.parse(query.get('to'));
    cards = cards.filter((c) => c.nextSessionAt && Date.parse(c.nextSessionAt) < to);
  }
  if (query.has('minPrice')) {
    const min = Number(query.get('minPrice'));
    cards = cards.filter((c) => c.fromPriceVnd !== null && c.fromPriceVnd >= min);
  }
  if (query.has('maxPrice')) {
    const max = Number(query.get('maxPrice'));
    cards = cards.filter((c) => c.fromPriceVnd !== null && c.fromPriceVnd < max);
  }
  const page = Number(query.get('page') ?? 0);
  // Backend kẹp `size` ở 60.
  const size = Math.min(Number(query.get('size') ?? 20), 60);
  return {
    items: cards.slice(page * size, page * size + size),
    total: cards.length,
    page,
    size,
    cities: [...new Set(state.events.map((e) => e.city).filter(Boolean))].sort(),
  };
}

// ---------------------------------------------------------------------------------------------
// Giữ chỗ, đơn hàng, vé
// ---------------------------------------------------------------------------------------------

function placeHold(res, sessionId, body, key) {
  if (!key) return problem(res, 400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header is required');
  if (state.holdKeys.has(key)) return send(res, 201, state.holdKeys.get(key));

  const map = state.seatMaps[sessionId];
  if (!map) return problem(res, 404, 'SESSION_NOT_FOUND', 'Session not found');

  const items = [];
  for (const line of body.seatedZones ?? []) {
    const free = map.seats.filter((s) => s.zoneCode === line.zoneCode && s.status === 'AVAILABLE');
    if (free.length < line.quantity) {
      return problem(res, 409, 'SEAT_UNAVAILABLE', 'Not enough seats in zone');
    }
    for (const seat of free.slice(0, line.quantity)) {
      seat.status = 'HELD';
      items.push({
        seatCode: seat.seatCode,
        zoneCode: seat.zoneCode,
        admissionType: 'SEATED',
        seatLabel: seat.seatLabel,
        ticketTypeName: seat.ticketTypeName,
        unitPriceVnd: seat.priceVnd,
        discountVnd: 0,
      });
    }
  }
  for (const line of body.standing ?? []) {
    const zone = map.standingZones.find((z) => z.zoneCode === line.zoneCode);
    if (!zone || zone.available < line.quantity) {
      return problem(res, 409, 'STANDING_SOLD_OUT', 'Not enough standing capacity');
    }
    zone.available -= line.quantity;
    for (let i = 0; i < line.quantity; i++) {
      items.push({
        seatCode: null,
        zoneCode: zone.zoneCode,
        admissionType: 'STANDING',
        seatLabel: null,
        ticketTypeName: zone.ticketTypeName,
        unitPriceVnd: zone.priceVnd,
        discountVnd: 0,
      });
    }
  }
  if (items.length === 0) return problem(res, 400, 'VALIDATION_FAILED', 'Empty hold');

  map.availabilityVersion += 1;
  const hold = {
    holdId: randomUUID(),
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    seatIds: [],
    availabilityVersion: map.availabilityVersion,
  };
  state.holds.set(hold.holdId, { sessionId, items });
  state.holdKeys.set(key, hold);
  return send(res, 201, hold);
}

function placeOrder(res, body, key) {
  if (!key) return problem(res, 400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header is required');
  if (state.orderKeys.has(key)) return send(res, 201, state.orderKeys.get(key));
  const hold = state.holds.get(body.holdId);
  if (!hold) return problem(res, 404, 'HOLD_NOT_FOUND', 'Hold not found');

  const total = hold.items.reduce((sum, item) => sum + item.unitPriceVnd, 0);
  const number = `NT${state.orderSeq++}`;
  const order = {
    id: randomUUID(),
    orderNumber: number,
    eventSessionId: hold.sessionId,
    eventId: null,
    status: 'AWAITING_PAYMENT',
    subtotalVnd: total,
    discountVnd: 0,
    totalVnd: total,
    paymentReference: number,
    vietQrPayload: `00020101021238570010A000000727${number}`,
    checkoutUrl: `${ORIGIN}/payos/checkout/${number}`,
    paymentExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    paidAt: null,
    items: hold.items,
  };
  state.orders.unshift(order);
  state.holds.delete(body.holdId);
  const created = {
    orderId: order.id,
    orderNumber: order.orderNumber,
    totalVnd: order.totalVnd,
    paymentReference: order.paymentReference,
    vietQrPayload: order.vietQrPayload,
    checkoutUrl: order.checkoutUrl,
    paymentExpiresAt: order.paymentExpiresAt,
  };
  state.orderKeys.set(key, created);
  return send(res, 201, created);
}

/** Giả lập webhook payOS đã ký: đơn sang PAID và ticketing phát vé. Chỉ test gọi. */
function markPaid(orderId) {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) return false;
  order.status = 'PAID';
  order.paidAt = new Date().toISOString();
  order.items.forEach((item, index) => {
    state.tickets.unshift({
      id: randomUUID(),
      orderId,
      eventSessionId: order.eventSessionId,
      seatCode: item.seatCode,
      zoneCode: item.zoneCode,
      admissionType: item.admissionType,
      seatLabel: item.seatLabel,
      ticketTypeName: item.ticketTypeName,
      status: 'VALID',
      checkedInAt: null,
      qrToken: `e2e.qr.${orderId}.${index}`,
    });
  });
  return true;
}

function page(list, query) {
  const limit = Math.min(Number(query.get('limit') ?? 20), 100);
  const offset = Number(query.get('offset') ?? 0);
  return list.slice(offset, offset + limit);
}

// ---------------------------------------------------------------------------------------------
// OIDC
// ---------------------------------------------------------------------------------------------

function discovery() {
  return {
    issuer: ISSUER,
    authorization_endpoint: `${ORIGIN}${OIDC}/auth`,
    token_endpoint: `${ORIGIN}${OIDC}/token`,
    userinfo_endpoint: `${ORIGIN}${OIDC}/userinfo`,
    jwks_uri: `${ORIGIN}${OIDC}/certs`,
    end_session_endpoint: `${ORIGIN}${OIDC}/logout`,
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    code_challenge_methods_supported: ['S256'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
    scopes_supported: ['openid', 'profile', 'email'],
  };
}

function authorize(res, query) {
  const redirectUri = query.get('redirect_uri') ?? '';
  // Chỉ trả code về đúng app đang test — một issuer thật cũng kiểm redirect_uri đã đăng ký.
  if (!WEB_ORIGIN || !redirectUri.startsWith(`${WEB_ORIGIN}/api/auth/callback/`)) {
    return problem(res, 400, 'INVALID_REDIRECT_URI', redirectUri);
  }
  const code = randomUUID();
  state.codes.set(code, {
    clientId: query.get('client_id'),
    nonce: query.get('nonce'),
    challenge: query.get('code_challenge'),
  });
  const target = new URL(redirectUri);
  target.searchParams.set('code', code);
  if (query.get('state')) target.searchParams.set('state', query.get('state'));
  res.writeHead(302, { Location: target.toString() });
  res.end();
}

function issueTokens(clientId, nonce) {
  const now = Math.floor(Date.now() / 1000);
  const accessToken = `e2e-at-${randomUUID()}`;
  const refreshToken = `e2e-rt-${randomUUID()}`;
  state.accessTokens.add(accessToken);
  state.refreshTokens.add(refreshToken);
  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 300,
    refresh_token: refreshToken,
    refresh_expires_in: 1800,
    scope: 'openid profile email',
    id_token: signJwt({
      iss: ISSUER,
      aud: clientId,
      azp: clientId,
      sub: USER.sub,
      iat: now,
      exp: now + 300,
      auth_time: now,
      ...(nonce ? { nonce } : {}),
      email: USER.email,
      email_verified: true,
      name: USER.name,
      preferred_username: USER.preferred_username,
    }),
  };
}

function clientIdOf(req, form) {
  const basic = (req.headers.authorization ?? '').match(/^Basic (.+)$/);
  if (basic) return decodeURIComponent(Buffer.from(basic[1], 'base64').toString().split(':')[0]);
  return form.get('client_id');
}

function token(req, res, form) {
  const grant = form.get('grant_type');
  const clientId = clientIdOf(req, form);
  if (grant === 'authorization_code') {
    const entry = state.codes.get(form.get('code'));
    state.codes.delete(form.get('code'));
    if (!entry) return send(res, 400, { error: 'invalid_grant' });
    // PKCE: một issuer thật bắt buộc verifier khớp challenge — làm đúng như vậy.
    const verifier = form.get('code_verifier') ?? '';
    const computed = createHash('sha256').update(verifier).digest('base64url');
    if (entry.challenge && computed !== entry.challenge) {
      return send(res, 400, { error: 'invalid_grant', error_description: 'PKCE mismatch' });
    }
    return send(res, 200, issueTokens(clientId ?? entry.clientId, entry.nonce));
  }
  if (grant === 'refresh_token') {
    if (!state.refreshTokens.has(form.get('refresh_token'))) {
      return send(res, 400, { error: 'invalid_grant' });
    }
    return send(res, 200, issueTokens(clientId, null));
  }
  return send(res, 400, { error: 'unsupported_grant_type' });
}

// ---------------------------------------------------------------------------------------------
// Định tuyến
// ---------------------------------------------------------------------------------------------

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', ORIGIN);
  const path = url.pathname;
  const method = req.method ?? 'GET';

  if (method === 'OPTIONS') return send(res, 204);

  try {
    // --- Điều khiển dành cho test ------------------------------------------------------------
    if (path === '/__health') return send(res, 200, { ok: true });
    if (path === '/__reset' && method === 'POST') {
      reset();
      return send(res, 204);
    }
    if (path === '/__requests') return send(res, 200, state.requests);
    const pay = path.match(/^\/__orders\/([^/]+)\/pay$/);
    if (pay && method === 'POST') return send(res, markPaid(pay[1]) ? 204 : 404);

    // --- OIDC ----------------------------------------------------------------------------------
    if (path === '/realms/nexaticket/.well-known/openid-configuration') {
      return send(res, 200, discovery());
    }
    if (path === `${OIDC}/auth` || path === `${OIDC}/registrations`) return authorize(res, url.searchParams);
    if (path === `${OIDC}/token` && method === 'POST') {
      return token(req, res, new URLSearchParams(await readBody(req)));
    }
    if (path === `${OIDC}/certs`) return send(res, 200, { keys: [JWK] });
    if (path === `${OIDC}/userinfo`) return send(res, 200, USER);
    if (path === `${OIDC}/logout`) return send(res, 204);

    // --- Gateway -------------------------------------------------------------------------------
    if (!path.startsWith('/v1/')) return problem(res, 404, 'NOT_FOUND', path);

    const raw = method === 'GET' || method === 'DELETE' ? '' : await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    state.requests.push({
      method,
      path,
      query: Object.fromEntries(url.searchParams),
      idempotencyKey: req.headers['idempotency-key'] ?? null,
      authorized: authed(req),
      body: raw ? body : null,
    });

    if (method === 'GET' && path === '/v1/events') return send(res, 200, listEvents(url.searchParams));
    if (method === 'GET' && path === '/v1/events/trending') return send(res, 200, []);

    const floor = path.match(/^\/v1\/events\/([^/]+)\/floor-plan$/);
    if (method === 'GET' && floor) return problem(res, 404, 'FLOOR_PLAN_NOT_FOUND', 'No floor plan');

    const event = path.match(/^\/v1\/events\/([^/]+)$/);
    if (method === 'GET' && event) {
      const found = state.events.find((e) => e.slug === decodeURIComponent(event[1]));
      return found ? send(res, 200, found) : problem(res, 404, 'EVENT_NOT_FOUND', 'Event not found');
    }

    const seats = path.match(/^\/v1\/sessions\/([^/]+)\/seats$/);
    if (method === 'GET' && seats) {
      const map = state.seatMaps[seats[1]];
      return map
        ? send(res, 200, map, { ETag: `"${map.availabilityVersion}"` })
        : problem(res, 404, 'SESSION_NOT_FOUND', 'Session not found');
    }

    // Mọi thứ còn lại cần đăng nhập — đúng như gateway.
    if (!authed(req)) return problem(res, 401, 'UNAUTHENTICATED', 'Missing or invalid bearer token');

    const holds = path.match(/^\/v1\/sessions\/([^/]+)\/holds$/);
    if (method === 'POST' && holds) return placeHold(res, holds[1], body, req.headers['idempotency-key']);
    if (method === 'POST' && path === '/v1/orders') return placeOrder(res, body, req.headers['idempotency-key']);
    if (method === 'GET' && path === '/v1/me/orders') return send(res, 200, page(state.orders, url.searchParams));
    if (method === 'GET' && path === '/v1/me/tickets') return send(res, 200, page(state.tickets, url.searchParams));

    const order = path.match(/^\/v1\/orders\/([^/]+)$/);
    if (method === 'GET' && order) {
      const found = state.orders.find((o) => o.id === order[1]);
      return found ? send(res, 200, found) : problem(res, 404, 'ORDER_NOT_FOUND', 'Order not found');
    }
    const orderTickets = path.match(/^\/v1\/orders\/([^/]+)\/tickets$/);
    if (method === 'GET' && orderTickets) {
      return send(res, 200, state.tickets.filter((t) => t.orderId === orderTickets[1]));
    }
    const cancel = path.match(/^\/v1\/orders\/([^/]+)\/cancel$/);
    if (method === 'POST' && cancel) {
      const found = state.orders.find((o) => o.id === cancel[1]);
      if (!found) return problem(res, 404, 'ORDER_NOT_FOUND', 'Order not found');
      if (found.status !== 'AWAITING_PAYMENT') {
        return problem(res, 409, 'ORDER_NOT_CANCELLABLE', 'Only unpaid orders can be cancelled');
      }
      found.status = 'CANCELLED';
      return send(res, 204);
    }

    return problem(res, 404, 'NOT_FOUND', `${method} ${path}`);
  } catch (error) {
    return problem(res, 500, 'INTERNAL_ERROR', String(error));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[stub] gateway + OIDC tại ${ORIGIN} (issuer ${ISSUER})`);
});
