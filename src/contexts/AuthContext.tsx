import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole, Profile } from '@/types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  isLoading: boolean;
  signUp: (email: string, password: string, fullName: string, phone: string, role?: AppRole) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string, remember?: boolean) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const REMEMBER_KEY = 'fx.auth.remember';
const SESSION_SENTINEL = 'fx.auth.session-alive';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    try {
      const [{ data: profileData }, { data: roleData }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
      ]);
      setProfile((profileData as Profile) ?? null);
      setRole((roleData?.role as AppRole) ?? null);
    } catch (error) {
      console.error('Error fetching user data:', error);
      setProfile(null);
      setRole(null);
    }
  };

  useEffect(() => {
    // "Remember me" enforcement (see note below).
    try {
      const remember = localStorage.getItem(REMEMBER_KEY);
      const alive = sessionStorage.getItem(SESSION_SENTINEL);
      if (remember === 'false' && !alive) {
        supabase.auth.signOut().catch(() => {});
        localStorage.removeItem(REMEMBER_KEY);
      } else if (remember === 'false') {
        sessionStorage.setItem(SESSION_SENTINEL, '1');
      }
    } catch {
      // ignore storage errors
    }

    let currentUserId: string | null = null;

    const applySession = async (session: Session | null, source: 'listener' | 'initial') => {
      const nextUserId = session?.user?.id ?? null;

      // If user identity changed (account switch / reopen with different session),
      // clear stale profile+role IMMEDIATELY so guards never see the wrong role.
      if (nextUserId !== currentUserId) {
        setProfile(null);
        setRole(null);
      }
      currentUserId = nextUserId;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Keep isLoading=true until role is resolved so route guards
        // (AdminLayout/RiderLayout/RestaurantLayout/Auth redirect) don't
        // act on a null/stale role and redirect to the wrong dashboard.
        setIsLoading(true);
        await fetchUserData(session.user.id);
      } else {
        setProfile(null);
        setRole(null);
      }
      setIsLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        try {
          localStorage.removeItem(REMEMBER_KEY);
          sessionStorage.removeItem(SESSION_SENTINEL);
        } catch {}
      }
      // Defer with setTimeout to avoid Supabase deadlock inside the listener.
      setTimeout(() => { applySession(session, 'listener'); }, 0);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session, 'initial');
    });

    return () => subscription.unsubscribe();
  }, []);



  const signUp = async (email: string, password: string, fullName: string, phone: string, _role: AppRole = 'customer') => {
    const redirectUrl = `${window.location.origin}/`;

    // SECURITY: only 'restaurant' or 'rider' can be requested at signup.
    // 'admin' is never accepted from the client — the DB trigger enforces this.
    const requestedRole: AppRole =
      _role === 'restaurant' || _role === 'rider' ? _role : 'customer';

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          phone,
          role: requestedRole,
        },
      },
    });

    // Ensure phone is persisted on the profile even if the DB trigger doesn't map it.
    if (!error && data.user) {
      try {
        await supabase.from('profiles').update({ phone }).eq('id', data.user.id);
      } catch (e) {
        console.error('profile phone update failed', e);
      }
    }

    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string, remember: boolean = true) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!error) {
      try {
        localStorage.setItem(REMEMBER_KEY, remember ? 'true' : 'false');
        if (remember) {
          sessionStorage.removeItem(SESSION_SENTINEL);
        } else {
          sessionStorage.setItem(SESSION_SENTINEL, '1');
        }
      } catch {}
    }

    return { error: error as Error | null };
  };


  const signOut = async () => {
    // 1) Revoke the session on the server (scope: 'global' also invalidates
    //    any other tabs/devices for the same user).
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (err) {
      console.error('signOut error', err);
    }

    // 2) Clear in-memory auth state so the UI reflects logout immediately.
    setSession(null);
    setUser(null);
    setProfile(null);
    setRole(null);

    // 3) Purge every trace of the session from browser storage:
    //    - Supabase auth tokens (sb-*-auth-token, supabase.auth.token)
    //    - App-specific cache: remember-me flag, session sentinel,
    //      cached userId / role / profile, notification prefs tied to user, etc.
    try {
      const purge = (storage: Storage) => {
        const keysToRemove: string[] = [];
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (!key) continue;
          if (
            key.startsWith('sb-') ||
            key.startsWith('supabase.') ||
            key.startsWith('fx.') ||          // app-scoped keys (auth, prefs, cache)
            key === 'userId' ||
            key === 'role' ||
            key === 'profile' ||
            key === 'user' ||
            key === 'authToken' ||
            key === 'access_token' ||
            key === 'refresh_token'
          ) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => storage.removeItem(k));
      };
      purge(localStorage);
      purge(sessionStorage);
    } catch (err) {
      console.error('storage purge error', err);
    }

    // 4) Clear React Query / any other in-memory caches by doing a hard redirect.
    if (typeof window !== 'undefined') {
      window.location.replace('/auth');
    }
  };


  const refreshProfile = async () => {
    if (user) {
      await fetchUserData(user.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        isLoading,
        signUp,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
