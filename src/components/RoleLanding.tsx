import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Root landing router. Waits for auth+role to resolve before deciding where
 * to send the user, so admins/riders/restaurant owners never flash the
 * customer view while their role is still loading.
 */
export default function RoleLanding() {
  const { user, role, isLoading } = useAuth();

  if (isLoading || (user && !role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user && role === 'admin') return <Navigate to="/admin" replace />;
  if (user && role === 'rider') return <Navigate to="/rider" replace />;
  if (user && role === 'restaurant') return <Navigate to="/restaurant" replace />;
  return <Navigate to="/restaurants" replace />;
}
