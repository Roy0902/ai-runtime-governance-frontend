import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setCsrf, type AuthContext } from './api';

interface AuthValue {
  context: AuthContext | null;
  refresh: () => Promise<AuthContext>;
  adopt: (context: AuthContext) => void;
  send: <T>(path: string, method: string, body?: unknown) => Promise<T>;
}

const AuthContextValue = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<AuthContext | null>(null);

  const adopt = useCallback((next: AuthContext) => {
    setCsrf(next.csrfToken);
    setContext(next);
  }, []);

  const refresh = useCallback(async () => {
    const next = await api<AuthContext>('/api/v1/auth/context');
    adopt(next);
    return next;
  }, [adopt]);

  const send = useCallback(async <T,>(path: string, method: string, body?: unknown): Promise<T> => {
    const result = await api<T>(path, { method, body });
    if (result && typeof result === 'object' && 'csrfToken' in (result as Record<string, unknown>)) {
      adopt(result as unknown as AuthContext);
    }
    return result;
  }, [adopt]);

  useEffect(() => {
    refresh().catch(() => {
      // Anonymous context is created by the endpoint; a transient failure leaves
      // the app on the anonymous shell until the user acts.
    });
    const timer = window.setInterval(() => {
      refresh().catch(() => {
        // Keep the current shell on a transient failure.
      });
    }, 2000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const value = useMemo(() => ({ context, refresh, adopt, send }), [context, refresh, adopt, send]);
  return <AuthContextValue.Provider value={value}>{children}</AuthContextValue.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContextValue);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
}
