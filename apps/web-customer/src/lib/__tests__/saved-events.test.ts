/* eslint-disable no-restricted-properties -- test của chính kho slug sự kiện công khai trong localStorage (saved-events.ts); không có token nào ở đây. */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const STORAGE_KEY = 'nexaticket.savedEvents.v1';

/**
 * Module giữ một snapshot ở module scope — nạp lại cho mỗi test để test này không thấy dữ liệu
 * test trước để lại.
 */
async function freshHook() {
  vi.resetModules();
  const { useSavedEvents } = await import('../saved-events');
  return renderHook(() => useSavedEvents());
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('useSavedEvents', () => {
  it('lưu rồi bỏ lưu một sự kiện, mới nhất lên đầu, ghi xuống localStorage', async () => {
    const { result } = await freshHook();
    expect(result.current.slugs).toEqual([]);

    act(() => result.current.toggle('a'));
    act(() => result.current.toggle('b'));
    expect(result.current.slugs).toEqual(['b', 'a']);
    expect(result.current.isSaved('a')).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null')).toEqual(['b', 'a']);

    act(() => result.current.toggle('a'));
    expect(result.current.slugs).toEqual(['b']);
    act(() => result.current.remove('b'));
    expect(result.current.slugs).toEqual([]);
  });

  it('giữ tối đa 60 sự kiện, bỏ cái cũ nhất', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Array.from({ length: 60 }, (_, i) => `e${i}`)),
    );
    const { result } = await freshHook();
    act(() => result.current.toggle('moi'));
    expect(result.current.slugs).toHaveLength(60);
    expect(result.current.slugs[0]).toBe('moi');
    expect(result.current.slugs).not.toContain('e59');
  });

  it('dữ liệu hỏng hoặc sai kiểu trong localStorage không làm sập trang', async () => {
    window.localStorage.setItem(STORAGE_KEY, '{không phải json');
    expect((await freshHook()).result.current.slugs).toEqual([]);

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(['ok', 42, null, { x: 1 }]));
    expect((await freshHook()).result.current.slugs).toEqual(['ok']);

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ a: 1 }));
    expect((await freshHook()).result.current.slugs).toEqual([]);
  });

  it('localStorage đầy (chế độ riêng tư) thì danh sách vẫn đúng trong phiên', async () => {
    const { result } = await freshHook();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    act(() => result.current.toggle('a'));
    expect(result.current.slugs).toEqual(['a']);
  });

  it('tab khác lưu thì tab này cập nhật theo sự kiện storage', async () => {
    const { result } = await freshHook();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(['tu-tab-khac']));
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
    });
    expect(result.current.slugs).toEqual(['tu-tab-khac']);

    // Sự kiện của khoá khác thì bỏ qua.
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(['x']));
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'khoa-khac' }));
    });
    expect(result.current.slugs).toEqual(['tu-tab-khac']);
  });
});
