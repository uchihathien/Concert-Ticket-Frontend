import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { restoreScannerSession, signOutScanner } from './auth-session';

interface ScannerAuthState {
  ready: boolean;
  signedIn: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const ScannerAuthContext = createContext<ScannerAuthState | null>(null);

export function ScannerAuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  const refresh = async () => {
    setSignedIn(await restoreScannerSession());
    setReady(true);
  };

  const signOut = async () => {
    await signOutScanner();
    setSignedIn(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <ScannerAuthContext.Provider value={{ ready, signedIn, refresh, signOut }}>
      {children}
    </ScannerAuthContext.Provider>
  );
}

export function useScannerAuth() {
  const state = useContext(ScannerAuthContext);
  if (!state) throw new Error('useScannerAuth must be used within ScannerAuthProvider');
  return state;
}