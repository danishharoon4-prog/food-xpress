import { useState } from 'react';
import type { ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Share2, Copy, MessageCircle, Facebook, Send, Twitter } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const SITE = 'https://food-xpress.lovable.app';

type InviteFriendsButtonProps = {
  className?: string;
  label?: string;
  /** Page to share, e.g. "/restaurant/<id>" or "/auth?mode=signup" */
  path?: string;
  /** Message shown with the link */
  text?: string;
  variant?: ComponentProps<typeof Button>['variant'];
  size?: ComponentProps<typeof Button>['size'];
  /** Icon-only button (for tight mobile headers) */
  iconOnly?: boolean;
};

export default function InviteFriendsButton({
  className,
  label = 'Invite Friends',
  path = '/auth?mode=signup',
  text = 'Food Xpress par apne shehr ke behtareen restaurants se khana order karein! Abhi signup karein:',
  variant = 'outline',
  size = 'default',
  iconOnly = false,
}: InviteFriendsButtonProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const sep = path.includes('?') ? '&' : '?';
  const link = `${SITE}${path}${user ? `${sep}ref=${user.id.slice(0, 8)}` : ''}`;
  const enc = encodeURIComponent;

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Food Xpress', text, url: link });
      } catch {
        /* user dismissed the share sheet */
      }
    } else {
      setOpen(true);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${text} ${link}`);
      toast.success('Invite link copy ho gaya');
    } catch {
      toast.error('Copy nahi ho saka, link manually copy karein');
    }
  };

  const items = [
    { name: 'WhatsApp', icon: MessageCircle, href: `https://wa.me/?text=${enc(`${text} ${link}`)}` },
    { name: 'Facebook', icon: Facebook, href: `https://www.facebook.com/sharer/sharer.php?u=${enc(link)}` },
    { name: 'Messenger', icon: Send, href: `fb-messenger://share/?link=${enc(link)}` },
    { name: 'Telegram', icon: Send, href: `https://t.me/share/url?url=${enc(link)}&text=${enc(text)}` },
    { name: 'X', icon: Twitter, href: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(link)}` },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={variant}
          size={iconOnly ? 'icon' : size}
          className={className}
          aria-label={label}
          onClick={(e) => {
            if (navigator.share) {
              e.preventDefault();
              nativeShare();
            }
          }}
        >
          <Share2 className={iconOnly ? 'h-4 w-4' : 'h-4 w-4 mr-2'} />
          {!iconOnly && label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Doston ko invite karein</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3">
          {items.map(({ name, icon: Icon, href }) => (
            <a
              key={name}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1 p-3 rounded-xl border hover:bg-secondary text-xs"
            >
              <Icon className="h-5 w-5 text-primary" />
              {name}
            </a>
          ))}
          <button
            onClick={copy}
            className="flex flex-col items-center gap-1 p-3 rounded-xl border hover:bg-secondary text-xs"
          >
            <Copy className="h-5 w-5 text-primary" />
            Copy Link
          </button>
        </div>
        <p className="text-xs text-muted-foreground break-all">{link}</p>
      </DialogContent>
    </Dialog>
  );
}
