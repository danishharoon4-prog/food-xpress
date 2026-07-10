import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAvatarSignedUrl, useProfileAvatar } from '@/lib/avatarUrl';
import defaultAdminAvatar from '@/assets/default-admin-avatar.png';
import defaultRiderAvatar from '@/assets/default-rider-avatar.png';

type Role = 'admin' | 'rider' | 'restaurant' | 'customer';

interface Props {
  role: Role;
  /** Preferred: pass the profile's stored avatar_url (storage path or legacy URL). */
  avatarUrl?: string | null;
  /** Alternative: pass a user id and we fetch profiles.avatar_url for you. */
  userId?: string | null;
  name?: string | null;
  className?: string;
  fallbackClassName?: string;
}

/**
 * Role-aware avatar. Falls back to a role-specific default image when the
 * user has not uploaded their own picture — so admins, riders, restaurants,
 * and customers always see a proper profile picture instead of a blank
 * initial circle.
 */
export default function RoleAvatar({
  role,
  avatarUrl,
  userId,
  name,
  className = 'w-10 h-10',
  fallbackClassName = 'bg-primary/10 text-primary font-semibold',
}: Props) {
  const fromValue = useAvatarSignedUrl(avatarUrl);
  const fromUser = useProfileAvatar(userId);
  const uploaded = avatarUrl !== undefined ? fromValue : fromUser;

  const defaults: Record<Role, string> = {
    admin: defaultAdminAvatar,
    rider: defaultRiderAvatar,
    restaurant: defaultAdminAvatar, // Food Express logo
    customer: defaultAdminAvatar,   // Food Express logo
  };

  const src = uploaded || defaults[role];
  const initial = (name || role).charAt(0).toUpperCase();

  return (
    <Avatar className={className}>
      <AvatarImage src={src} alt={name || role} className="object-cover" />
      <AvatarFallback className={fallbackClassName}>{initial}</AvatarFallback>
    </Avatar>
  );
}
