import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { restoreMobileSession, signOutMobile } from './auth-session';

interface AuthState { ready: boolean; signedIn: boolean; refresh: () => Promise<void>; signOut: () => Promise<void> }
const AuthContext = createContext<AuthState | null>(null);

export function MobileAuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const refresh = async () => { setSignedIn(await restoreMobileSession()); setReady(true); };
  const signOut = async () => { await signOutMobile(); setSignedIn(false); };
  useEffect(() => { void refresh(); }, []);
  return <AuthContext.Provider value={{ ready, signedIn, refresh, signOut }}>{children}</AuthContext.Provider>;
}

export function useMobileAuth() {
  const state = useContext(AuthContext);
  if (!state) throw new Error('useMobileAuth must be used within MobileAuthProvider');
  return state;
}