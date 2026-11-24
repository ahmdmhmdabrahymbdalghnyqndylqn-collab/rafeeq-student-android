import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from './supabase';

type AuthContextValue = {
  configured: boolean;
  ready: boolean;
  session: Session | null;
  profileReady: boolean;
  profileComplete: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);
  const [profileReady, setProfileReady] = useState(!supabase);
  const [profileComplete, setProfileComplete] = useState(false);

  const refreshProfile = useCallback(async (nextSession?: Session | null) => {
    const client = supabase;
    const activeSession = nextSession === undefined ? session : nextSession;
    if (!client || !activeSession) {
      setProfileComplete(false);
      setProfileReady(true);
      return;
    }
    setProfileReady(false);
    const { data } = await client.from('profiles').select('phone_e164').eq('id', activeSession.user.id).maybeSingle();
    setProfileComplete(Boolean(data?.phone_e164));
    setProfileReady(true);
  }, [session]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let mounted = true;
    void client.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setReady(true);
        void refreshProfile(data.session);
      }
    });
    const { data: subscription } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) {
        setSession(nextSession);
        void refreshProfile(nextSession);
      }
    });
    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({ configured: supabase !== null, ready, session, profileReady, profileComplete, refreshProfile }), [profileComplete, profileReady, ready, refreshProfile, session]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
