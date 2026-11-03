import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthenticationContext } from './api/AuthenticationContext';
import { apiRequest, setCsrfToken } from './ApplicationApiClient';

interface AuthenticationValue {
  context: AuthenticationContext | null;
  loading: boolean;
  refreshError: string | null;
  refresh: () => Promise<AuthenticationContext>;
  adopt: (context: AuthenticationContext) => void;
  send: <T>(path: string, method: string, body?: unknown) => Promise<T>;
}

const AuthenticationContextValue = createContext<AuthenticationValue | null>(null);

export function AuthenticationProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<AuthenticationContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const adopt = useCallback((next: AuthenticationContext) => {
    setCsrfToken(next.csrfToken);
    setContext(next);
    setLoading(false);
    setRefreshError(null);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setRefreshError(null);
    try {
      const next = await apiRequest<AuthenticationContext>('/api/v1/auth/context');
      adopt(next);
      return next;
    } catch (caught) {
      setRefreshError('Unable to load your session. Check your connection and try again.');
      throw caught;
    } finally {
      setLoading(false);
    }
  }, [adopt]);

  const send = useCallback(async <T,>(path: string, method: string, body?: unknown): Promise<T> => {
    const result = await apiRequest<T>(path, { method, body });
    if (result && typeof result === 'object' && 'csrfToken' in (result as Record<string, unknown>)) {
      adopt(result as unknown as AuthenticationContext);
    }
    return result;
  }, [adopt]);

  useEffect(() => {
    refresh().catch(() => {
      // The provider exposes the failure state to routes for an explicit retry.
    });
  }, [refresh]);

  const value = useMemo(
    () => ({ context, loading, refreshError, refresh, adopt, send }),
    [context, loading, refreshError, refresh, adopt, send],
  );
  return <AuthenticationContextValue.Provider value={value}>{children}</AuthenticationContextValue.Provider>;
}

export function useAuthentication(): AuthenticationValue {
  const value = useContext(AuthenticationContextValue);
  if (!value) {
    throw new Error('useAuthentication must be used inside AuthenticationProvider');
  }
  return value;
}
