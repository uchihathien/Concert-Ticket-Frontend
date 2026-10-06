import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

/**
 * Sự kiện đã lưu — lưu TRÊN MÁY, không qua backend.
 *
 * Backend chưa có API "sự kiện yêu thích", nên danh sách nằm ở thiết bị: lưu trên điện thoại không
 * tự hiện trên web và ngược lại. Khi có API thì thay phần đọc/ghi trong file này, giao diện giữ nguyên.
 *
 * Chỉ lưu `slug`: SecureStore trên iOS giới hạn ~2 KB mỗi giá trị. 60 slug (~30 byte/slug) còn xa
 * trần đó; tên, ảnh, ngày diễn tải lại từ API công khai lúc mở danh sách — nên cũng luôn mới.
 */
const STORAGE_KEY = 'nexaticket.savedEvents.v1';
const MAX_SAVED = 60;

interface SavedEventsState {
  slugs: string[];
  ready: boolean;
  isSaved: (slug: string) => boolean;
  toggle: (slug: string) => void;
  remove: (slug: string) => void;
}

const SavedEventsContext = createContext<SavedEventsState | null>(null);

async function readSlugs(): Promise<string[]> {
  try {
    const raw = Platform.OS === 'web' ? globalThis.localStorage?.getItem(STORAGE_KEY) : await SecureStore.getItemAsync(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

async function writeSlugs(slugs: string[]) {
  const raw = JSON.stringify(slugs);
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(STORAGE_KEY, raw);
    else await SecureStore.setItemAsync(STORAGE_KEY, raw);
  } catch {
    // Ghi hỏng thì danh sách vẫn đúng trong phiên này; chỉ mất khi mở lại app.
  }
}

export function SavedEventsProvider({ children }: { children: ReactNode }) {
  const [slugs, setSlugs] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void readSlugs().then((value) => {
      if (!active) return;
      setSlugs(value);
      setReady(true);
    });
    return () => { active = false; };
  }, []);

  const update = useCallback((next: (current: string[]) => string[]) => {
    setSlugs((current) => {
      const value = next(current);
      void writeSlugs(value);
      return value;
    });
  }, []);

  const value = useMemo<SavedEventsState>(() => ({
    slugs,
    ready,
    isSaved: (slug) => slugs.includes(slug),
    // Mới lưu đứng đầu; quá trần thì bỏ cái cũ nhất.
    toggle: (slug) => update((current) => (current.includes(slug) ? current.filter((item) => item !== slug) : [slug, ...current].slice(0, MAX_SAVED))),
    remove: (slug) => update((current) => current.filter((item) => item !== slug)),
  }), [slugs, ready, update]);

  return <SavedEventsContext.Provider value={value}>{children}</SavedEventsContext.Provider>;
}

export function useSavedEvents() {
  const state = useContext(SavedEventsContext);
  if (!state) throw new Error('useSavedEvents must be used within SavedEventsProvider');
  return state;
}
