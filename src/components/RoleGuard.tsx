import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { AppRole } from '@/types';

interface RoleGuardProps {
  /** Roles allowed to view the wrapped subtree. */
  allow: AppRole | AppRole[];
  /** Where to send unauthenticated / wrong-role users. Defaults to `/auth?role=<first allowed>`. */
  redirectTo?: string;
  /** Optional extra readiness signal (e.g. verification / restaurant profile load). */
  ready?: boolean;
  children: ReactNode;
}

/**
 * Global route guard.
 *
 * While auth/role is still resolving (`isLoading`) — or the optional `ready`
 * signal is `false` — we render a spinner and BLOCK any redirect. Only after
 * loading finishes do we check the role and redirect if it doesn't match.
 *
 * This prevents the race where a freshly-restored session flashes a null role,
 * causing the layout to bounce the user to `/auth` before their real role loads.
 */
export function RoleGuard({ allow, redirectTo, ready = true, children }: RoleGuardProps) {
  const { user, role, isLoading } = useAuth();
  const location = useLocation();
  const allowed = Array.isArray(allow) ? allow : [allow];

  if (isLoading || !ready) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="min-h-screen flex flex-col items-center justify-center bg-background gap-3"
      >
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Loading your account…</p>
      </div>
    );
  }

  if (!user || !role || !allowed.includes(role)) {
    const target = redirectTo ?? `/auth?role=${allowed[0]}`;
    return <Navigate to={target} replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
