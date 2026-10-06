'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Sự kiện đã lưu — lưu trong trình duyệt (localStorage), không qua backend.
 *
 * Backend chưa có API "sự kiện yêu thích", nên danh sách nằm ở máy: lưu trên web không tự hiện
 * trong app điện thoại và ngược lại (app giữ danh sách riêng trong SecureStore). Khi có API thì
 * chỉ thay phần đọc/ghi ở file này.
 *
 * Chỉ lưu `slug`; tên, ảnh, giá, ngày diễn tải lại từ API công khai lúc hiển thị nên luôn mới.
 */
const STORAGE_KEY = 'nexaticket.savedEvents.v1';
const MAX_SAVED = 60;
const EMPTY: string[] = [];

const listeners = new Set<() => void>();
let snapshot: string[] | null = null;

function read(): string[] {
  if (snapshot) return snapshot;
  try {
    // eslint-disable-next-line no-restricted-properties -- chỉ lưu slug sự kiện công khai, không phải token; quy tắc plan §4 nhắm vào access token.
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    snapshot = Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    snapshot = [];
  }
  return snapshot;
}

function write(next: string[]) {
  snapshot = next;
  try {
    // eslint-disable-next-line no-restricted-properties -- chỉ lưu slug sự kiện công khai, không phải token; quy tắc plan §4 nhắm vào access token.
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Chế độ riêng tư / hết dung lượng: danh sách vẫn đúng trong phiên này.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Lưu ở tab khác thì tab này cập nhật theo.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    snapshot = null;
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function useSavedEvents() {
  // Server render: chưa biết localStorage → coi như rỗng; trình duyệt cập nhật ngay sau hydrate.
  const slugs = useSyncExternalStore(subscribe, read, () => EMPTY);

  const toggle = useCallback((slug: string) => {
    const current = read();
    write(current.includes(slug) ? current.filter((item) => item !== slug) : [slug, ...current].slice(0, MAX_SAVED));
  }, []);

  const remove = useCallback((slug: string) => {
    write(read().filter((item) => item !== slug));
  }, []);

  return { slugs, isSaved: (slug: string) => slugs.includes(slug), toggle, remove };
}
