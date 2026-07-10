import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useAvatarSignedUrl } from '@/lib/avatarUrl';

interface Props {
  subtitle?: string;
  roleLabel?: string;
}

/**
 * Shared welcome banner shown at the top of admin / rider / restaurant
 * dashboards. Displays the signed-in user's uploaded profile picture
 * (falls back to initials) alongside their name.
 */
export default function DashboardWelcome({ subtitle, roleLabel }: Props) {
  const { user, profile } = useAuth();
  const avatarSignedUrl = useAvatarSignedUrl(profile?.avatar_url);

  const name = profile?.full_name || user?.email?.split('@')[0] || 'User';
  const initials =
    profile?.full_name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase() || name.charAt(0).toUpperCase();

  return (
    <div className="relative rounded-2xl bg-gradient-to-r from-primary to-primary/70 text-primary-foreground p-5 md:p-6 overflow-hidden">
      <div className="absolute top-0 right-0 w-40 h-40 bg-primary-foreground/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-1/2 w-24 h-24 bg-primary-foreground/5 rounded-full translate-y-1/2" />
      <div className="relative flex items-center gap-4">
        <Avatar className="h-14 w-14 md:h-16 md:w-16 border-2 border-primary-foreground/30">
          <AvatarImage src={avatarSignedUrl || ''} className="object-cover" />
          <AvatarFallback className="bg-primary-foreground/20 text-primary-foreground text-lg font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          {roleLabel && (
            <p className="text-xs uppercase tracking-wide text-primary-foreground/70">{roleLabel}</p>
          )}
          <h1 className="text-xl md:text-2xl font-bold truncate">
            Welcome back, {name.split(' ')[0]}! 👋
          </h1>
          {subtitle && (
            <p className="text-primary-foreground/80 text-sm mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}
