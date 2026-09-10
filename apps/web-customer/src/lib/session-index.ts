import { getPublicEvent, listPublicEvents } from '@nexaticket/ts-sdk';
import { cache } from 'react';
import { serverApi } from './server-api';

/**
 * Tra ngược từ `eventSessionId` về sự kiện.
 *
 * Vì sao phải có: `GET /v1/me/tickets` chỉ trả `eventSessionId`, không có tên sự kiện, ngày diễn
 * hay địa điểm — ticketing-service không biết những thứ đó. Không tra ngược thì ví vé của khách
 * là một danh sách UUID.
 *
 * Cách làm hiện tại tốn kém một cách lộ liễu: lấy danh sách sự kiện đang bán rồi gọi tiếp trang
 * chi tiết của TỪNG sự kiện, vì endpoint danh sách không trả `sessions`. Chấp nhận được ở quy mô
 * hiện tại (22 sự kiện, gọi song song, cache 5 phút), nhưng nó tăng tuyến tính theo số sự kiện.
 *
 * Việc cần báo cho phía backend, không tự sửa được ở đây:
 *   1. `TicketView` nên mang sẵn tên sự kiện và giờ diễn — đó là thứ MỌI client đều phải tra.
 *   2. Hoặc mở một endpoint tra nhiều suất một lần, kiểu `GET /v1/sessions?ids=a,b,c`.
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

/** Backend chặn trần `size` ở 60. */
const MAX_PAGE_SIZE = 60;

/**
 * `cache()` gộp mọi lời gọi trong CÙNG một request thành một lượt tải.
 *
 * Trang vé và trang đơn hàng đều cần bảng tra này; không có nó thì mỗi trang tự tải một lần.
 */
export const loadSessionIndex = cache(async (): Promise<SessionIndex> => {
  let page;
  try {
    page = await listPublicEvents(serverApi, { size: MAX_PAGE_SIZE });
  } catch {
    // Catalog hỏng thì ví vé vẫn phải mở được — vé là thứ khách cần ở cửa vào, còn tên sự kiện
    // chỉ là thứ cho dễ đọc. Trả bảng rỗng và để màn hình hiện phần nó biết.
    return {};
  }

  const details = await Promise.allSettled(
    page.items.map((card) => getPublicEvent(serverApi, card.slug)),
  );

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
});
