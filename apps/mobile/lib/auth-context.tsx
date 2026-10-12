import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { restoreMobileSession, signOutMobile } from './auth-session';
import { loadActiveRole, resolveRoles, saveActiveRole, type AppRole } from './roles';

/**
 * Nhóm màn hình đang mở. Khách chưa đăng nhập ở `customer`; `choose` là tài khoản nhiều vai chưa
 * chọn; `error` là đã đăng nhập nhưng chưa hỏi được quyền từ backend.
 */
export type AppMode = AppRole | 'choose' | 'error';

interface MobileAuthState {
  ready: boolean;
  signedIn: boolean;
  roles: AppRole[];
  mode: AppMode;
  refresh: () => Promise<AppMode>;
  signOut: () => Promise<void>;
  chooseRole: (role: AppRole) => Promise<void>;
  switchRole: () => Promise<void>;
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
  if (!session.signedIn) return 'customer';
  if (session.failed) return 'error';
  if (session.roles.length === 1) return session.roles[0];
  return session.activeRole && session.roles.includes(session.activeRole) ? session.activeRole : 'choose';
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
    await signOutMobile();
    await saveActiveRole(null);
    setSession(guest);
  }, []);

  const chooseRole = useCallback(async (role: AppRole) => {
    await saveActiveRole(role);
    setSession((current) => ({ ...current, activeRole: role }));
  }, []);

  const switchRole = useCallback(async () => {
    await saveActiveRole(null);
    setSession((current) => ({ ...current, activeRole: null }));
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
      switchRole,
    }),
    [ready, session, refresh, signOut, chooseRole, switchRole],
  );

  return <MobileAuthContext.Provider value={value}>{children}</MobileAuthContext.Provider>;
}

export function useMobileAuth() {
  const state = useContext(MobileAuthContext);
  if (!state) throw new Error('useMobileAuth must be used within MobileAuthProvider');
  return state;
}
