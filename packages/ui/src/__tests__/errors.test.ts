import { describe, expect, it } from 'vitest';
import { errorCopy, errorMessage, isKnownErrorCode, publishBlockerLabel } from '../errors';

describe('từ điển lỗi', () => {
  it('dịch mã backend sang câu tiếng Việt và chọn cách hiện', () => {
    expect(errorCopy('SEAT_UNAVAILABLE')).toEqual({
      message: 'Ghế vừa được người khác giữ',
      display: 'toast',
      retryable: true,
    });
    expect(errorCopy('HOLD_EXPIRED').display).toBe('modal');
  });

  it('tên mã trong tài liệu trỏ về đúng mã backend thật sự phát ra', () => {
    // plan §7 viết TOO_MANY_SEATS, backend phát HOLD_LIMIT_EXCEEDED.
    expect(errorCopy('TOO_MANY_SEATS')).toEqual(errorCopy('HOLD_LIMIT_EXCEEDED'));
    expect(errorCopy('SESSION_NOT_ON_SALE')).toEqual(errorCopy('SALES_CLOSED'));
    expect(errorCopy('REDIS_UNAVAILABLE')).toEqual(errorCopy('INVENTORY_UNAVAILABLE'));
  });

  it('mã lạ rơi về câu mặc định, không lộ chuỗi kỹ thuật', () => {
    expect(errorCopy('MÃ_CHƯA_TỪNG_CÓ').message).toBe('Có lỗi xảy ra, thử lại sau');
    expect(errorCopy(undefined).message).toBe('Có lỗi xảy ra, thử lại sau');
    expect(isKnownErrorCode('MÃ_CHƯA_TỪNG_CÓ')).toBe(false);
    expect(isKnownErrorCode('ZONE_SOLD_OUT')).toBe(true);
  });

  it('nêu rõ trần hiện hành khi backend gửi kèm meta', () => {
    expect(errorMessage({ code: 'HOLD_LIMIT_EXCEEDED', meta: { limit: 8 } })).toBe(
      'Vượt số vé tối đa mỗi lần giữ (tối đa 8 vé)',
    );
    expect(errorMessage({ code: 'CUSTOMER_LIMIT_EXCEEDED', meta: { remaining: 2 } })).toBe(
      'Bạn đã đạt giới hạn vé cho suất này (còn được mua 2 vé)',
    );
  });

  it('thiếu meta thì vẫn trả câu gốc chứ không ghép "undefined"', () => {
    expect(errorMessage({ code: 'HOLD_LIMIT_EXCEEDED' })).toBe('Vượt số vé tối đa mỗi lần giữ');
    expect(errorMessage({ code: 'CUSTOMER_LIMIT_EXCEEDED', meta: { remaining: 'x' } })).toBe(
      'Bạn đã đạt giới hạn vé cho suất này',
    );
  });

  it('publish bị chặn thì liệt kê đủ vướng mắc, vì "chưa xuất bản được" không nói được gì', () => {
    expect(
      errorMessage({
        code: 'PUBLISH_BLOCKED',
        meta: { blockers: ['NO_SESSION', 'VENUE_WITHOUT_ZONE'] },
      }),
    ).toBe('Chưa xuất bản được: Chưa có suất diễn nào; Địa điểm chưa có khu vực nào');

    // Không có meta thì vẫn là một câu hoàn chỉnh, không phải "Chưa xuất bản được: ".
    expect(errorMessage({ code: 'PUBLISH_BLOCKED' })).toBe('Chưa xuất bản được');
  });

  it('vướng mắc lạ hiện nguyên tên thay vì biến mất khỏi checklist', () => {
    expect(publishBlockerLabel('SESSION_WITHOUT_TICKET_TYPE')).toContain('hạng vé');
    expect(publishBlockerLabel('VƯỚNG_MẮC_MỚI')).toBe('VƯỚNG_MẮC_MỚI');
  });
});
