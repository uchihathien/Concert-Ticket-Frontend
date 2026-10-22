import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isStaffApp } from './app-variant';
import { restoreMobileSession, signOutMobile } from './auth-session';
import { clearOfflineData } from './offline/store';
import { loadActiveRole, resolveRoles, saveActiveRole, type AppRole } from './roles';

/**
 * Nhóm màn hình đang mở.
 *
 * - Bản khách: khách chưa đăng nhập ở `customer`; tài khoản không có vai khách (ban tổ chức, nhân
 *   viên, quản trị) ở `not-customer`.
 * - Bản staff: chưa đăng nhập ở `staff-login`; tài khoản không có vai nhân viên ở `not-staff`.
 * - `error`: đã đăng nhập nhưng chưa hỏi được quyền từ backend.
 */
export type AppMode = AppRole | 'staff-login' | 'not-customer' | 'not-staff' | 'error';

interface MobileAuthState {
  ready: boolean;
  signedIn: boolean;
  roles: AppRole[];
  mode: AppMode;
  refresh: () => Promise<AppMode>;
  signOut: () => Promise<void>;
  /** Chỉ bản staff: chuyển giữa khu ban tổ chức và khu soát vé của cùng một tài khoản. */
  chooseRole: (role: AppRole) => Promise<void>;
}

interface Session {
  signedIn: boolean;
  roles: AppRole[];
  activeRole: AppRole | null;
  failed: boolean;
}

const guest: Session = { signedIn: false, roles: [], activeRole: null, failed: false };

const MobileAuthContext = createContext<MobileAuthState | null>(null);

function modeOf(session: Session): AppMode {
  if (!session.signedIn) return isStaffApp ? 'staff-login' : 'customer';
  if (session.failed) return 'error';
  if (!isStaffApp) return session.roles.includes('customer') ? 'customer' : 'not-customer';

  const organizer = session.roles.includes('organizer');
  const scanner = session.roles.includes('scanner');
  // Có cả hai vai thì mặc định vào khu ban tổ chức; tab "Soát vé" ở đó chuyển sang máy quét.
  if (organizer && scanner) return session.activeRole === 'scanner' ? 'scanner' : 'organizer';
  if (organizer) return 'organizer';
  if (scanner) return 'scanner';
  return 'not-staff';
}

async function loadSession(): Promise<Session> {
  if (!(await restoreMobileSession())) return guest;
  try {
    const [roles, activeRole] = await Promise.all([resolveRoles(), loadActiveRole()]);
    return { signedIn: true, roles, activeRole, failed: false };
  } catch {
    return { signedIn: true, roles: [], activeRole: null, failed: true };
  }
}

export function MobileAuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session>(guest);

  const refresh = useCallback(async () => {
    const next = await loadSession();
    setSession(next);
    setReady(true);
    return modeOf(next);
  }, []);

  const signOut = useCallback(async () => {
    // Dữ liệu vé tải về để soát offline không được ở lại máy sau khi người dùng rời đi.
    clearOfflineData();
    await signOutMobile();
    await saveActiveRole(null);
    setSession(guest);
  }, []);

  const chooseRole = useCallback(async (role: AppRole) => {
    await saveActiveRole(role);
    setSession((current) => ({ ...current, activeRole: role }));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      ready,
      signedIn: session.signedIn,
      roles: session.roles,
      mode: modeOf(session),
      refresh,
      signOut,
      chooseRole,
    }),
    [ready, session, refresh, signOut, chooseRole],
  );

  return <MobileAuthContext.Provider value={value}>{children}</MobileAuthContext.Provider>;
}

export function useMobileAuth() {
  const state = useContext(MobileAuthContext);
  if (!state) throw new Error('useMobileAuth must be used within MobileAuthProvider');
  return state;
}
