import { getPublicEvent, listPublicEvents } from '@nexaticket/ts-sdk';
import { api } from './api';

/**
 * Suất diễn → sự kiện (tên, ngày giờ, địa điểm, ảnh).
 *
 * Vé và đơn hàng chỉ mang `eventSessionId`; không có endpoint "tra suất theo id". Cách web-customer
 * đang làm (lib/session-index.ts bên đó): lấy danh sách sự kiện công khai rồi chi tiết từng cái để
 * dựng bảng tra. Ở đây cache 5 phút trong bộ nhớ — mở tab Vé rồi sang Đơn hàng không tải lại.
 */
export interface SessionInfo {
  slug: string;
  eventTitle: string;
  startsAt: string;
  endsAt: string | null;
  venueName: string | null;
  city: string | null;
  posterUrl: string | null;
}

export type SessionIndex = Record<string, SessionInfo>;

const TTL_MS = 5 * 60 * 1000;
const PAGE_SIZE = 60;
let cached: { at: number; value: Promise<SessionIndex> } | null = null;

async function build(): Promise<SessionIndex> {
  const page = await listPublicEvents(api, { size: PAGE_SIZE });
  const details = await Promise.allSettled(page.items.map((card) => getPublicEvent(api, card.slug)));
  const index: SessionIndex = {};
  for (const result of details) {
    if (result.status !== 'fulfilled') continue;
    const event = result.value;
    for (const session of event.sessions) {
      index[session.id] = {
        slug: event.slug,
        eventTitle: event.title,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        venueName: event.venueName,
        city: event.city,
        posterUrl: event.posterUrl,
      };
    }
  }
  return index;
}

/** Không tải được thì trả bảng rỗng: màn vé/đơn vẫn hiện, chỉ thiếu tên sự kiện. */
export function loadSessionIndex(force = false): Promise<SessionIndex> {
  if (!force && cached && Date.now() - cached.at < TTL_MS) return cached.value;
  const value = build().catch(() => {
    cached = null;
    return {} as SessionIndex;
  });
  cached = { at: Date.now(), value };
  return value;
}

export function formatSessionTime(startsAt: string) {
  return new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(startsAt));
}
