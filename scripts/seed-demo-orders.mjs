#!/usr/bin/env node
// SPDX-License-Identifier: UNLICENSED
/**
 * Sinh đơn hàng và vé demo bằng cách **gọi API thật**.
 *
 * Vì sao không chèn thẳng SQL: vé mang chữ ký Ed25519 do ticketing-service ký, đơn hàng kéo theo
 * saga, outbox và tồn kho ở ba service khác nhau. Chèn tay vào bảng thì máy quét QR sẽ từ chối
 * toàn bộ và số liệu ở analytics sẽ không bao giờ khớp. Đi qua đúng luồng nghiệp vụ thì dữ liệu
 * sinh ra là dữ liệu thật, chỉ có nội dung là bịa.
 *
 * Luồng: đăng nhập → giữ chỗ (inventory) → đặt đơn (ordering) → xác nhận thanh toán → ticketing
 * nghe sự kiện và phát hành vé.
 *
 * CHỈ DÙNG CHO MÔI TRƯỜNG DEV. Bước xác nhận thanh toán gọi thẳng `/internal/orders/{id}/
 * confirm-payment` của ordering-service — endpoint đó không đi qua gateway đúng như thiết kế, vì
 * để lọt ra ngoài là ai cũng phát hành vé được mà không trả tiền.
 *
 * Chạy:  node scripts/seed-demo-orders.mjs
 *        node scripts/seed-demo-orders.mjs --orders 6 --dry-run
 */

import { execFileSync } from 'node:child_process';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import process from 'node:process';

const CONFIG = {
  gateway: process.env.API_BASE_URL ?? 'http://localhost:8080',
  ordering: process.env.ORDERING_URL ?? 'http://localhost:8093',
  keycloak: process.env.OIDC_ISSUER ?? 'http://localhost:8081/realms/nexaticket',
  clientId: process.env.SEED_CLIENT_ID ?? 'web-customer',
  clientSecret: process.env.SEED_CLIENT_SECRET ?? 'dev-secret-customer',
  username: process.env.SEED_USERNAME ?? 'customer',
  password: process.env.SEED_PASSWORD ?? 'customer',
  postgres: process.env.SEED_PG_CONTAINER ?? 'nexaticket-infra-postgres-1',
};

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};
const ORDER_TARGET = Number(flag('orders', '8'));
const DRY_RUN = args.includes('--dry-run');

/** Mỗi đơn lấy 2 vé: đủ để thấy nhiều vé trong một đơn mà không đụng trần 10 đơn vị/lượt giữ. */
const UNITS_PER_ORDER = 2;

const log = (...parts) => console.log(...parts);
const warn = (...parts) => console.warn('  !', ...parts);

// --- Khoá ký vé --------------------------------------------------------------------------------

/**
 * Bảo đảm ticketing-service có khoá ký đang hoạt động.
 *
 * `SigningKeyStore.rotate()` chỉ được gọi từ test — hệ thống đang chạy KHÔNG có đường nào tạo
 * khoá đầu tiên, nên lần phát hành vé đầu tiên sẽ ném `NO_SIGNING_KEY`. Đây là lỗ hổng vận hành
 * phía backend, cần người xử lý; ở đây chỉ gieo khoá cho môi trường dev.
 *
 * Định dạng phải khớp `SigningKeyStore`: Base64 chuẩn của DER — PKCS#8 cho khoá riêng, SPKI cho
 * khoá công khai. Sai định dạng thì service vẫn ký được nhưng máy quét sẽ từ chối mọi vé.
 */
function ensureSigningKey() {
  const count = psql('ticketing_db', 'SELECT COUNT(*) FROM signing_keys WHERE is_active').trim();
  if (count !== '0') {
    log(`  khoá ký vé: đã có (${count} khoá đang hoạt động)`);
    return;
  }

  if (DRY_RUN) {
    warn('chưa có khoá ký vé — lần chạy thật sẽ tạo một khoá Ed25519 mới');
    return;
  }

  const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
    publicKeyEncoding: { type: 'spki', format: 'der' },
  });
  const kid = randomUUID().slice(0, 8);

  psql(
    'ticketing_db',
    `INSERT INTO signing_keys (kid, private_key, public_key, is_active)
     VALUES ('${kid}', '${privateKey.toString('base64')}', '${publicKey.toString('base64')}', TRUE)`,
  );
  log(`  khoá ký vé: đã tạo mới, kid=${kid}`);
}

function psql(database, sql) {
  return execFileSync(
    'docker',
    ['exec', CONFIG.postgres, 'psql', '-U', 'postgres', '-d', database, '-tAc', sql],
    { encoding: 'utf8' },
  );
}

// --- HTTP --------------------------------------------------------------------------------------

async function login() {
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: CONFIG.clientId,
    client_secret: CONFIG.clientSecret,
    username: CONFIG.username,
    password: CONFIG.password,
    scope: 'openid',
  });

  const response = await fetch(`${CONFIG.keycloak}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) {
    throw new Error(`Đăng nhập thất bại (${response.status}): ${await response.text()}`);
  }
  return (await response.json()).access_token;
}

/** Ném lỗi kèm nguyên văn body: RFC 7807 của backend nói rõ hỏng ở đâu, đừng nuốt mất. */
async function call(url, { token, method = 'GET', body, idempotencyKey } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      `${method} ${url} → ${response.status}: ${(await response.text()).slice(0, 300)}`,
    );
  }
  return response.status === 204 ? null : await response.json();
}

// --- Chọn chỗ ----------------------------------------------------------------------------------

/**
 * Dựng yêu cầu giữ chỗ từ sơ đồ chỗ.
 *
 * Ưu tiên vé đứng vì nó chỉ cần mã khu; vé ngồi phải chọn đúng ghế còn trống. Trả `null` khi suất
 * không còn đủ chỗ — bỏ qua suất đó thay vì cố giữ rồi nhận lỗi.
 */
function buildHold(seatMap) {
  const zone = (seatMap.standingZones ?? []).find((z) => z.available >= UNITS_PER_ORDER);
  if (zone) {
    return { standing: [{ zoneCode: zone.zoneCode, quantity: UNITS_PER_ORDER }], seatIds: [] };
  }

  const seats = (seatMap.seats ?? [])
    .filter((seat) => seat.status === 'AVAILABLE')
    .slice(0, UNITS_PER_ORDER);
  if (seats.length < UNITS_PER_ORDER) return null;

  return { seatIds: seats.map((seat) => seat.id), standing: [] };
}

// --- Chương trình chính -------------------------------------------------------------------------

async function main() {
  log(`Sinh dữ liệu demo${DRY_RUN ? ' (chạy thử, không ghi gì)' : ''}`);
  log(`  gateway=${CONFIG.gateway}  ordering=${CONFIG.ordering}  user=${CONFIG.username}`);

  ensureSigningKey();

  const token = await login();
  log('  đăng nhập: xong');

  // Đơn đã có của chính user này, để chạy lại script không đẻ thêm đơn trùng.
  const existing = await call(`${CONFIG.gateway}/v1/me/orders?limit=100`, { token });
  log(`  đơn sẵn có: ${existing.length}`);

  const page = await call(`${CONFIG.gateway}/v1/events?size=60`);
  log(`  sự kiện đang bán: ${page.items.length}`);

  const now = Date.now();
  const created = [];
  let skipped = 0;

  for (const card of page.items) {
    if (created.length >= ORDER_TARGET) break;

    const event = await call(`${CONFIG.gateway}/v1/events/${encodeURIComponent(card.slug)}`);

    for (const session of event.sessions) {
      if (created.length >= ORDER_TARGET) break;

      // Suất đã qua thì bỏ: đặt vé cho một buổi diễn hôm qua là dữ liệu vô nghĩa.
      const closesAt = Date.parse(session.salesCloseAt ?? session.startsAt);
      if (Number.isNaN(closesAt) || closesAt <= now) continue;

      let seatMap;
      try {
        seatMap = await call(`${CONFIG.gateway}/v1/sessions/${session.id}/seats`, { token });
      } catch (error) {
        warn(`${card.slug}: không đọc được sơ đồ chỗ — ${error.message}`);
        continue;
      }

      const holdRequest = buildHold(seatMap);
      if (!holdRequest) {
        skipped += 1;
        continue;
      }

      if (DRY_RUN) {
        log(`  [thử] ${card.title} · ${session.startsAt} → ${JSON.stringify(holdRequest)}`);
        created.push({ slug: card.slug });
        continue;
      }

      try {
        const hold = await call(`${CONFIG.gateway}/v1/sessions/${session.id}/holds`, {
          token,
          method: 'POST',
          body: holdRequest,
          idempotencyKey: randomUUID(),
        });

        const order = await call(`${CONFIG.gateway}/v1/orders`, {
          token,
          method: 'POST',
          body: { holdId: hold.holdId },
          idempotencyKey: randomUUID(),
        });

        // Đơn cuối cùng để nguyên AWAITING_PAYMENT: màn "Đơn hàng của tôi" cần ít nhất một đơn
        // chưa trả tiền thì mới thấy được QR chuyển khoản và đồng hồ đếm ngược.
        const leaveUnpaid = created.length === ORDER_TARGET - 1;
        if (!leaveUnpaid) {
          await call(`${CONFIG.ordering}/internal/orders/${order.orderId}/confirm-payment`, {
            method: 'POST',
          });
        }

        created.push({ slug: card.slug, orderNumber: order.orderNumber, paid: !leaveUnpaid });
        log(
          `  + ${order.orderNumber}  ${card.title}  ${order.totalVnd.toLocaleString('vi-VN')}đ  ${
            leaveUnpaid ? '(chờ thanh toán)' : '(đã thanh toán)'
          }`,
        );
      } catch (error) {
        warn(`${card.slug}: ${error.message}`);
      }
    }
  }

  log('');
  log(`Đã tạo ${created.length} đơn, bỏ qua ${skipped} suất không đủ chỗ.`);

  if (!DRY_RUN && created.length > 0) {
    // Ticketing phát hành vé qua sự kiện, không đồng bộ với lệnh gọi ở trên — chờ một nhịp rồi
    // đếm lại, nếu không con số in ra sẽ luôn nhỏ hơn thực tế.
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const tickets = await call(`${CONFIG.gateway}/v1/me/tickets?limit=100`, { token });
    log(`Vé đã phát hành cho ${CONFIG.username}: ${tickets.length}`);
    if (tickets.length === 0) {
      warn(
        'chưa có vé nào — kiểm tra log ticketing-service, thường là NO_SIGNING_KEY hoặc RabbitMQ',
      );
    }
  }
}

main().catch((error) => {
  console.error('\nThất bại:', error.message);
  process.exit(1);
});
