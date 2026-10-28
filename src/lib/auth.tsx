import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import type { SessionPayload } from '../types';

type AuthValue = {
  session: SessionPayload | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setSession: (session: SessionPayload | null) => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const next = await api<SessionPayload>('/api/session');
      setSession(next);
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('crt-off', session?.workspace.crtOverlay === false);
  }, [session]);

  return <AuthContext.Provider value={{ session, loading, refresh, setSession }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider is missing');
  return value;
}
