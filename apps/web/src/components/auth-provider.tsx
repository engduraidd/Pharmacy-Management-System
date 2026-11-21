'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { SessionInfo } from '@pharmacy/shared';
import { api } from '@/lib/api';

type AuthState = { session: SessionInfo | null; loading: boolean; setSession: (value: SessionInfo | null) => void };
const AuthContext = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    api<SessionInfo>('/auth/me').then(value => { if (mounted) setSession(value); }).catch(() => {})
      .finally(() => { if (mounted) setLoading(false); });
    const expired = () => setSession(null);
    window.addEventListener('pharmacy:session-expired', expired);
    return () => { mounted = false; window.removeEventListener('pharmacy:session-expired', expired); };
  }, []);
  return <AuthContext.Provider value={{ session, loading, setSession }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('AuthProvider is required.');
  return auth;
}
