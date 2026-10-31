import { useState } from "react";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { QrCode, Copy, MessageCircle, Facebook, Send, Twitter } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import DownloadApkButton, { DOWNLOAD_ENDPOINT } from "@/components/DownloadApkButton";

const SHARE_TEXT =
  "Food Xpress app download karein — apne shehr ke behtareen restaurants se khana order karein!";

type Props = {
  className?: string;
  label?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  iconOnly?: boolean;
};

/**
 * Restaurant page par app download link share karne ka button:
 * QR code (scan = direct APK download), share links aur copy.
 */
export default function ShareAppDownloadButton({
  className,
  label = "Share App Link",
  variant = "outline",
  size = "default",
  iconOnly = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const link = DOWNLOAD_ENDPOINT;
  const enc = encodeURIComponent;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${SHARE_TEXT} ${link}`);
      toast.success("Download link copy ho gaya");
    } catch {
      toast.error("Copy nahi ho saka, link manually copy karein");
    }
  };

  const items = [
    { name: "WhatsApp", icon: MessageCircle, href: `https://wa.me/?text=${enc(`${SHARE_TEXT} ${link}`)}` },
    { name: "Facebook", icon: Facebook, href: `https://www.facebook.com/sharer/sharer.php?u=${enc(link)}` },
    { name: "Telegram", icon: Send, href: `https://t.me/share/url?url=${enc(link)}&text=${enc(SHARE_TEXT)}` },
    { name: "X", icon: Twitter, href: `https://twitter.com/intent/tweet?text=${enc(SHARE_TEXT)}&url=${enc(link)}` },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={iconOnly ? "icon" : size} className={className} aria-label={label}>
          <QrCode className={iconOnly ? "h-4 w-4" : "h-4 w-4 mr-2"} />
          {!iconOnly && label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>App download link share karein</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3">
          <div className="rounded-2xl border bg-card p-3">
            <QRCodeCanvas value={link} size={180} includeMargin />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            QR scan karte hi APK download shuru ho jayega
          </p>
          <DownloadApkButton label="Download App" showVersion className="w-full" />
        </div>

        <div className="grid grid-cols-3 gap-3 mt-2">
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
