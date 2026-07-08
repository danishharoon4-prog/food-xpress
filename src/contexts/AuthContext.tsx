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
  signUp: (email: string, password: string, fullName: string, role?: AppRole) => Promise<{ error: Error | null }>;
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
      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData as Profile);
      }

      // Fetch role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleData) {
        setRole(roleData.role as AppRole);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  useEffect(() => {
    // "Remember me" enforcement:
    // If the last sign-in opted out of "remember me", the session should only
    // survive within the same browser session (across tab refreshes, not
    // across full browser restarts). sessionStorage is cleared when the
    // browser/tab is closed — so if the sentinel is missing on load while
    // remember=false, we treat it as a fresh browser start and sign out.
    try {
      const remember = localStorage.getItem(REMEMBER_KEY);
      const alive = sessionStorage.getItem(SESSION_SENTINEL);
      if (remember === 'false' && !alive) {
        supabase.auth.signOut().catch(() => {});
        localStorage.removeItem(REMEMBER_KEY);
      } else if (remember === 'false') {
        // Keep sentinel refreshed for this browser session
        sessionStorage.setItem(SESSION_SENTINEL, '1');
      }
    } catch {
      // ignore storage errors (private mode, etc.)
    }

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Defer Supabase calls with setTimeout to avoid deadlock
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRole(null);
        }

        if (event === 'SIGNED_OUT') {
          setProfile(null);
          setRole(null);
          try {
            localStorage.removeItem(REMEMBER_KEY);
            sessionStorage.removeItem(SESSION_SENTINEL);
          } catch {}
        }

        setIsLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);


  const signUp = async (email: string, password: string, fullName: string, _role: AppRole = 'customer') => {
    const redirectUrl = `${window.location.origin}/`;

    // SECURITY: only 'restaurant' or 'rider' can be requested at signup.
    // 'admin' is never accepted from the client — the DB trigger enforces this.
    const requestedRole: AppRole =
      _role === 'restaurant' || _role === 'rider' ? _role : 'customer';

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          role: requestedRole,
        },
      },
    });

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
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('signOut error', err);
    }
    // Clear local auth state immediately so UI reflects logout even if
    // the network call fails or the session was already gone.
    setSession(null);
    setUser(null);
    setProfile(null);
    setRole(null);
    // Hard redirect ensures every provider/cache resets cleanly.
    if (typeof window !== 'undefined') {
      window.location.href = '/auth';
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
