import { describe, expect, it } from 'vitest';

import { resolveApiBaseUrl } from '../http/base-url';

describe('resolveApiBaseUrl', () => {
  it('giữ nguyên URL tuyệt đối khi biến có giá trị', () => {
    expect(resolveApiBaseUrl('https://api.concertth.site', 'production')).toBe(
      'https://api.concertth.site',
    );
  });

  // Chuỗi rỗng là thứ đã đưa production vào ngõ cụt: `??` cho nó đi qua, `baseUrl` thành '' và mọi
  // lời gọi rơi vào Next thay vì gateway. Ở production rỗng = cùng gốc, và đó là một đích HỢP LỆ vì
  // nginx phục vụ /v1/ trên chính tên miền web.
  it.each(['', '   ', undefined])('production + giá trị rỗng (%p) -> cùng gốc', (raw) => {
    expect(resolveApiBaseUrl(raw, 'production')).toBe('');
  });

  // Máy phát triển không có nginx ở giữa, nên rỗng phải về gateway.
  it.each(['', undefined])('development + giá trị rỗng (%p) -> gateway localhost', (raw) => {
    expect(resolveApiBaseUrl(raw, 'development')).toBe('http://localhost:8080');
  });

  it('bỏ dấu gạch cuối — ApiClient tự nối /v1/..., hai gạch liền làm gateway trả 404', () => {
    expect(resolveApiBaseUrl('https://api.concertth.site///', 'production')).toBe(
      'https://api.concertth.site',
    );
  });

  it('khoảng trắng hai đầu không biến một URL thật thành chế độ cùng gốc', () => {
    expect(resolveApiBaseUrl('  https://api.concertth.site  ', 'production')).toBe(
      'https://api.concertth.site',
    );
  });
});
