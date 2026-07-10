import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useProfileAvatar } from '@/lib/avatarUrl';
import defaultRiderAvatar from '@/assets/default-rider-avatar.png';

interface Props {
  userId?: string | null;
  name?: string | null;
  className?: string;
}

/**
 * Rider avatar with a project-wide default image fallback.
 * If the rider has uploaded their own avatar (profiles.avatar_url), we show it;
 * otherwise we fall back to the Food Express default rider avatar.
 */
export default function RiderAvatar({ userId, name, className = 'w-10 h-10' }: Props) {
  const url = useProfileAvatar(userId);
  const src = url || defaultRiderAvatar;
  return (
    <Avatar className={className}>
      <AvatarImage src={src} alt={name || 'Rider'} className="object-cover" />
      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
        {(name || 'R').charAt(0).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

export { defaultRiderAvatar };
