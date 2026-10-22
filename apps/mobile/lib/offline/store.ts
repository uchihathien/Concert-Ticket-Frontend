import {
  getCheckinBundle,
  syncOfflineScans,
  type CheckinBundle,
  type CheckinBundleTicket,
  type GateScanResponse,
  type GateScanResult,
  type ScanDirection,
  type SyncResult,
} from '@nexaticket/ts-sdk';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { api } from '../api';
import { storageKey } from '../app-variant';
import { base64UrlToBytes, verifyTicketQr } from './verify-qr';

/**
 * Dữ liệu soát vé trên máy, cho lúc mất mạng.
 *
 * <h3>Vì sao SQLite, không phải AsyncStorage</h3>
 *
 * Một suất có thể vài nghìn vé, và mỗi lượt quét phải tra một vé theo `jti` và ghi lại trạng thái
 * trong/ngoài ngay. AsyncStorage là một khối JSON — đọc / ghi lại cả khối cho mỗi lượt quét ở cửa
 * đông người là thứ làm máy khựng đúng lúc cần nhanh nhất.
 *
 * <h3>Ba bảng</h3>
 *
 * - `tickets`: vé của suất kèm trạng thái trong/ngoài THEO MÁY NÀY (cập nhật sau mỗi lượt quét).
 * - `keys`: khoá công khai để tự kiểm chữ ký QR.
 * - `queue`: lượt quét chờ gửi lên. Gửi được thì xoá.
 *
 * Mỗi bản app một tệp riêng; đăng xuất hoặc ca kết thúc quá 6 giờ thì xoá sạch dữ liệu vé.
 */
const db = Platform.OS === 'web' ? null : SQLite.openDatabaseSync(`${storageKey('checkin')}.db`);

/** Dữ liệu vé của ca đã kết thúc quá chừng này thì xoá khỏi máy. */
const KEEP_AFTER_SHIFT_MS = 6 * 60 * 60 * 1000;
const SYNC_BATCH = 200;

db?.execSync(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY NOT NULL,
    organization_id TEXT NOT NULL,
    server_time TEXT NOT NULL,
    shift_ends_at TEXT,
    downloaded_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tickets (
    session_id TEXT NOT NULL,
    ticket_id TEXT NOT NULL,
    code TEXT NOT NULL,
    ticket_type_name TEXT,
    zone_code TEXT,
    seat_code TEXT,
    seat_label TEXT,
    holder_name TEXT,
    holder_folded TEXT,
    email_masked TEXT,
    phone_masked TEXT,
    status TEXT NOT NULL,
    inside INTEGER NOT NULL,
    entry_count INTEGER NOT NULL,
    last_entry_at TEXT,
    last_entry_gate TEXT,
    PRIMARY KEY (session_id, ticket_id)
  );
  CREATE INDEX IF NOT EXISTS idx_tickets_code ON tickets (session_id, code);
  CREATE TABLE IF NOT EXISTS keys (kid TEXT PRIMARY KEY NOT NULL, public_key TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS queue (
    client_scan_id TEXT PRIMARY KEY NOT NULL,
    organization_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    qr_token TEXT,
    ticket_code TEXT,
    ticket_id TEXT,
    direction TEXT NOT NULL,
    scanned_at TEXT NOT NULL,
    device_result TEXT NOT NULL
  );
`);

interface TicketRow {
  ticket_id: string;
  code: string;
  ticket_type_name: string | null;
  zone_code: string | null;
  seat_code: string | null;
  seat_label: string | null;
  holder_name: string | null;
  email_masked: string | null;
  phone_masked: string | null;
  status: string;
  inside: number;
  entry_count: number;
  last_entry_at: string | null;
  last_entry_gate: string | null;
}

let deviceIdCache: string | null = null;

/** Id cố định của máy này — ghi vào mọi lượt quét để biết lượt nào từ máy nào. */
export async function deviceId(): Promise<string> {
  if (deviceIdCache) return deviceIdCache;
  const key = storageKey('device-id');
  const stored = Platform.OS === 'web' ? null : await SecureStore.getItemAsync(key).catch(() => null);
  deviceIdCache = stored ?? `staff-${Crypto.randomUUID().slice(0, 8)}`;
  if (!stored && Platform.OS !== 'web') await SecureStore.setItemAsync(key, deviceIdCache).catch(() => undefined);
  return deviceIdCache;
}

/** Bỏ dấu tiếng Việt — cùng phép với hàm SQL `vn_fold` của server. */
export function fold(value: string): string {
  return value.toLowerCase().replace(/đ/g, 'd').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Tải gói dữ liệu của suất. Lần đầu (hoặc khi chưa có) tải toàn bộ; sau đó chỉ phần đổi từ lần trước.
 *
 * @param shiftEndsAt giờ kết thúc ca — để biết khi nào xoá dữ liệu này khỏi máy
 */
export async function downloadBundle(organizationId: string, sessionId: string, shiftEndsAt?: string | null) {
  if (!db) return;
  const meta = db.getFirstSync<{ server_time: string }>('SELECT server_time FROM sessions WHERE session_id = ?', sessionId);
  const bundle = await getCheckinBundle(api, organizationId, sessionId, meta?.server_time);
  saveBundle(organizationId, bundle, shiftEndsAt ?? null);
}

function saveBundle(organizationId: string, bundle: CheckinBundle, shiftEndsAt: string | null) {
  if (!db) return;
  db.withTransactionSync(() => {
    if (bundle.full) db.runSync('DELETE FROM tickets WHERE session_id = ?', bundle.eventSessionId);
    for (const key of bundle.keys) {
      db.runSync('INSERT OR REPLACE INTO keys (kid, public_key) VALUES (?, ?)', key.kid, key.publicKey);
    }
    for (const ticket of bundle.tickets) upsertTicket(bundle.eventSessionId, ticket);
    db.runSync(
      `INSERT INTO sessions (session_id, organization_id, server_time, shift_ends_at, downloaded_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (session_id) DO UPDATE SET server_time = excluded.server_time,
         shift_ends_at = COALESCE(excluded.shift_ends_at, sessions.shift_ends_at), downloaded_at = excluded.downloaded_at`,
      bundle.eventSessionId,
      organizationId,
      bundle.serverTime,
      shiftEndsAt,
      new Date().toISOString(),
    );
  });
}

function upsertTicket(sessionId: string, ticket: CheckinBundleTicket) {
  db?.runSync(
    `INSERT OR REPLACE INTO tickets (session_id, ticket_id, code, ticket_type_name, zone_code, seat_code, seat_label,
       holder_name, holder_folded, email_masked, phone_masked, status, inside, entry_count, last_entry_at, last_entry_gate)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    sessionId,
    ticket.ticketId,
    ticket.code,
    ticket.ticketTypeName,
    ticket.zoneCode,
    ticket.seatCode,
    ticket.seatLabel,
    ticket.holderName,
    fold(ticket.holderName ?? ''),
    ticket.emailMasked,
    ticket.phoneMasked,
    ticket.status,
    ticket.inside ? 1 : 0,
    ticket.entryCount,
    ticket.lastEntryAt,
    ticket.lastEntryGate,
  );
}

/** Máy đã có dữ liệu của suất này chưa (để quyết định có soát offline được không). */
export function hasBundle(sessionId: string): boolean {
  return Boolean(db?.getFirstSync('SELECT 1 FROM sessions WHERE session_id = ?', sessionId));
}

export function pendingCount(sessionId?: string): number {
  if (!db) return 0;
  const row = sessionId
    ? db.getFirstSync<{ n: number }>('SELECT count(*) AS n FROM queue WHERE session_id = ?', sessionId)
    : db.getFirstSync<{ n: number }>('SELECT count(*) AS n FROM queue');
  return row?.n ?? 0;
}

/** Một lượt soát vé quyết định TẠI MÁY — cùng thứ tự kiểm như server, trên dữ liệu đã tải. */
export async function scanOffline(input: {
  organizationId: string;
  sessionId: string;
  direction: ScanDirection;
  qrToken?: string;
  ticketCode?: string;
  ticketId?: string;
  gate?: string | null;
}): Promise<GateScanResponse> {
  const now = new Date().toISOString();
  let ticket: TicketRow | null = null;
  let result: GateScanResult;
  let note: string | null = null;

  if (input.ticketId) {
    ticket = findTicket(input.sessionId, input.ticketId);
  } else if (input.ticketCode) {
    // Mã gõ tay là phần đầu id vé (cùng quy ước với server), không phân biệt hoa thường.
    const code = input.ticketCode.trim().toLowerCase();
    const found =
      db?.getAllSync<TicketRow>(
        'SELECT * FROM tickets WHERE session_id = ? AND ticket_id LIKE ? LIMIT 2',
        input.sessionId,
        `${code}%`,
      ) ?? [];
    if (found.length > 1) note = 'Mã trùng nhiều vé, hãy nhập thêm ký tự';
    else ticket = found[0] ?? null;
  } else if (input.qrToken) {
    const verified = verifyTicketQr(input.qrToken, loadKeys());
    if (!verified) {
      result = 'INVALID_TOKEN';
      note = 'Mã không hợp lệ hoặc đã hết hạn';
      return enqueueAndRespond(input, now, result, null, note);
    }
    ticket = findTicket(input.sessionId, verified.jti);
  }

  if (!ticket) {
    // Vé của suất khác cũng rơi vào đây: dữ liệu trên máy chỉ có vé của suất đang soát.
    return enqueueAndRespond(input, now, 'NOT_FOUND', null, note ?? 'Không có vé này trong dữ liệu của suất');
  }
  if (ticket.status === 'REVOKED') {
    return enqueueAndRespond(input, now, 'REVOKED', ticket, 'Vé đã bị huỷ hoặc hoàn tiền');
  }
  if (input.direction === 'IN') {
    if (ticket.inside) {
      return enqueueAndRespond(input, now, 'ALREADY_CHECKED_IN', ticket, 'Vé đang ở trong khu vực');
    }
    db?.runSync(
      `UPDATE tickets SET inside = 1, entry_count = entry_count + 1, last_entry_at = ?, last_entry_gate = ?, status = 'CHECKED_IN'
        WHERE session_id = ? AND ticket_id = ?`,
      now,
      input.gate ?? null,
      input.sessionId,
      ticket.ticket_id,
    );
    return enqueueAndRespond(input, now, 'ACCEPTED', findTicket(input.sessionId, ticket.ticket_id), null);
  }
  if (!ticket.inside) {
    return enqueueAndRespond(input, now, 'NOT_INSIDE', ticket, 'Vé chưa vào hoặc đã ra ngoài');
  }
  db?.runSync('UPDATE tickets SET inside = 0 WHERE session_id = ? AND ticket_id = ?', input.sessionId, ticket.ticket_id);
  return enqueueAndRespond(input, now, 'EXITED', ticket, null);
}

function enqueueAndRespond(
  input: { organizationId: string; sessionId: string; direction: ScanDirection; qrToken?: string; ticketCode?: string; ticketId?: string },
  scannedAt: string,
  result: GateScanResult,
  ticket: TicketRow | null,
  note: string | null,
): GateScanResponse {
  db?.runSync(
    `INSERT INTO queue (client_scan_id, organization_id, session_id, qr_token, ticket_code, ticket_id, direction, scanned_at, device_result)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    Crypto.randomUUID(),
    input.organizationId,
    input.sessionId,
    input.qrToken ?? null,
    input.ticketCode ?? null,
    input.ticketId ?? null,
    input.direction,
    scannedAt,
    result,
  );
  return {
    result,
    direction: input.direction,
    seatCode: ticket?.seat_code ?? null,
    seatLabel: ticket?.seat_label ?? null,
    ticketTypeName: ticket?.ticket_type_name ?? null,
    note,
    ticketCode: ticket?.code ?? null,
    holderName: ticket?.holder_name ?? null,
    zoneCode: ticket?.zone_code ?? null,
    entryCount: ticket?.entry_count ?? 0,
    lastEntryAt: ticket?.last_entry_at ?? null,
    lastEntryGate: ticket?.last_entry_gate ?? null,
    ticketSessionId: null,
  };
}

function findTicket(sessionId: string, ticketId: string): TicketRow | null {
  return db?.getFirstSync<TicketRow>('SELECT * FROM tickets WHERE session_id = ? AND ticket_id = ?', sessionId, ticketId) ?? null;
}

function loadKeys(): Map<string, Uint8Array> {
  const rows = db?.getAllSync<{ kid: string; public_key: string }>('SELECT kid, public_key FROM keys') ?? [];
  return new Map(rows.map((row) => [row.kid, base64UrlToBytes(row.public_key)]));
}

/** Tìm khách trong dữ liệu trên máy: tên (không dấu) hoặc mã vé. Email / SĐT trên máy đã bị che. */
export function searchOffline(sessionId: string, query: string): CheckinBundleTicket[] {
  if (!db || query.trim().length < 2) return [];
  const folded = `%${fold(query.trim())}%`;
  const code = `${query.trim().toLowerCase()}%`;
  return db
    .getAllSync<TicketRow>(
      `SELECT * FROM tickets WHERE session_id = ? AND (holder_folded LIKE ? OR ticket_id LIKE ? OR lower(email_masked) LIKE ?)
       ORDER BY holder_name LIMIT 20`,
      sessionId,
      folded,
      code,
      folded,
    )
    .map((row) => ({
      ticketId: row.ticket_id,
      code: row.code,
      ticketTypeName: row.ticket_type_name,
      zoneCode: row.zone_code,
      seatCode: row.seat_code,
      seatLabel: row.seat_label,
      holderName: row.holder_name,
      emailMasked: row.email_masked,
      phoneMasked: row.phone_masked,
      status: row.status as CheckinBundleTicket['status'],
      inside: Boolean(row.inside),
      entryCount: row.entry_count,
      lastEntryAt: row.last_entry_at,
      lastEntryGate: row.last_entry_gate,
      changedAt: null,
    }));
}

interface QueueRow {
  client_scan_id: string;
  organization_id: string;
  session_id: string;
  qr_token: string | null;
  ticket_code: string | null;
  ticket_id: string | null;
  direction: ScanDirection;
  scanned_at: string;
  device_result: string;
}

/**
 * Gửi hàng đợi của một suất lên server theo lô. Lô nào server nhận (kể cả bị từ chối) thì xoá khỏi
 * máy; mất mạng giữa chừng thì phần còn lại để lần sau — gửi lại không ghi trùng nhờ `clientScanId`.
 *
 * @return gộp kết quả mọi lô đã gửi được; `null` nếu không có gì để gửi
 */
export async function syncQueue(organizationId: string, sessionId: string): Promise<SyncResult | null> {
  if (!db) return null;
  const device = await deviceId();
  const total: SyncResult = { accepted: 0, conflicts: 0, scans: [] };
  let sent = false;
  for (;;) {
    const batch = db.getAllSync<QueueRow>(
      'SELECT * FROM queue WHERE session_id = ? ORDER BY scanned_at LIMIT ?',
      sessionId,
      SYNC_BATCH,
    );
    if (batch.length === 0) break;
    const result = await syncOfflineScans(
      api,
      organizationId,
      sessionId,
      batch.map((row) => ({
        clientScanId: row.client_scan_id,
        qrToken: row.qr_token,
        ticketCode: row.ticket_code,
        ticketId: row.ticket_id,
        direction: row.direction,
        scannedAt: row.scanned_at,
        deviceId: device,
        deviceResult: row.device_result,
      })),
    );
    db.withTransactionSync(() => {
      for (const row of batch) db?.runSync('DELETE FROM queue WHERE client_scan_id = ?', row.client_scan_id);
    });
    sent = true;
    total.accepted += result.accepted;
    total.conflicts += result.conflicts;
    total.scans.push(...result.scans);
  }
  return sent ? total : null;
}

/** Xoá dữ liệu vé của những ca đã kết thúc quá 6 giờ. Hàng đợi chưa gửi thì GIỮ — đó là lượt quét thật. */
export function purgeExpired(now: number = Date.now()) {
  if (!db) return;
  const old = db.getAllSync<{ session_id: string }>(
    'SELECT session_id FROM sessions WHERE shift_ends_at IS NOT NULL AND shift_ends_at < ?',
    new Date(now - KEEP_AFTER_SHIFT_MS).toISOString(),
  );
  db.withTransactionSync(() => {
    for (const row of old) {
      db?.runSync('DELETE FROM tickets WHERE session_id = ?', row.session_id);
      db?.runSync('DELETE FROM sessions WHERE session_id = ?', row.session_id);
    }
  });
}

/** Đăng xuất: xoá sạch dữ liệu vé trên máy, kể cả hàng đợi (người khác đăng nhập không gửi hộ được). */
export function clearOfflineData() {
  db?.execSync('DELETE FROM tickets; DELETE FROM sessions; DELETE FROM keys; DELETE FROM queue;');
}
