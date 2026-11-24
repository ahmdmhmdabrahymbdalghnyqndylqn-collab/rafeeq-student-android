import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from './supabase';

export type AdminAuthState = 'unconfigured' | 'checking' | 'unauthenticated' | 'authorized' | 'forbidden';
type AdminAuthContextValue = { state: AdminAuthState; session: Session | null; refresh: () => Promise<void>; signOut: () => Promise<void> };
const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<AdminAuthState>(supabase ? 'checking' : 'unconfigured');

  const evaluate = useCallback(async (nextSession?: Session | null) => {
    const client = supabase;
    const activeSession = nextSession === undefined ? session : nextSession;
    if (!client) { setState('unconfigured'); return; }
    if (!activeSession) { setState('unauthenticated'); return; }
    setState('checking');
    const { data, error } = await client.rpc('is_admin');
    setState(!error && data === true ? 'authorized' : 'forbidden');
  }, [session]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let mounted = true;
    void client.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      void evaluate(data.session);
    });
    const { data: subscription } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      void evaluate(nextSession);
    });
    return () => { mounted = false; subscription.subscription.unsubscribe(); };
  }, [evaluate]);

  const signOut = useCallback(async () => { await supabase?.auth.signOut(); }, []);
  const value = useMemo(() => ({ state, session, refresh: evaluate, signOut }), [evaluate, session, signOut, state]);
  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const value = useContext(AdminAuthContext);
  if (!value) throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  return value;
}
