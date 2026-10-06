import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { restoreMobileSession, signOutMobile } from './auth-session';

interface MobileAuthState {
  ready: boolean;
  signedIn: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const MobileAuthContext = createContext<MobileAuthState | null>(null);

export function MobileAuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  const refresh = async () => {
    setSignedIn(await restoreMobileSession());
    setReady(true);
  };

  const signOut = async () => {
    await signOutMobile();
    setSignedIn(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <MobileAuthContext.Provider value={{ ready, signedIn, refresh, signOut }}>
      {children}
    </MobileAuthContext.Provider>
  );
}

export function useMobileAuth() {
  const state = useContext(MobileAuthContext);
  if (!state) throw new Error('useMobileAuth must be used within MobileAuthProvider');
  return state;
}