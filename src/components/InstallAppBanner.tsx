import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download, X, Smartphone } from "lucide-react";
import { startApkDownload } from "@/components/DownloadApkButton";
import { toast } from "sonner";

const DISMISS_KEY = "fx_apk_banner_dismissed_at";
const DISMISS_MS = 1000 * 60 * 60 * 24 * 3; // 3 days


const isCapacitor = () =>
  typeof window !== "undefined" &&
  (!!(window as any).Capacitor?.isNativePlatform?.() ||
    navigator.userAgent.includes("FoodXpressApp"));

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  (navigator as any).standalone === true;

export default function InstallAppBanner() {
  const [show, setShow] = useState(false);
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    // Browser ka apna PWA "Add to Home screen" prompt band — hum apni APK offer dete hain
    const block = (e: Event) => e.preventDefault();
    window.addEventListener("beforeinstallprompt", block);

    const isAndroid = /Android/i.test(navigator.userAgent);
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    const recentlyDismissed = Date.now() - dismissedAt < DISMISS_MS;

    if (!isAndroid || isCapacitor() || isStandalone() || recentlyDismissed) {
      return () => window.removeEventListener("beforeinstallprompt", block);
    }

    let active = true;
    (async () => {
      const { data } = await supabase
        .from("app_releases")
        .select("version")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active || !data) return;
      setVersion((data as { version: string }).version);
      setShow(true);
    })();

    return () => {
      active = false;
      window.removeEventListener("beforeinstallprompt", block);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-md rounded-2xl border bg-card shadow-2xl p-3 flex items-center gap-3">
        <div className="w-11 h-11 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
          <Smartphone className="w-6 h-6 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">Food Xpress App install karein</p>
          <p className="text-xs text-muted-foreground truncate">
            Tez ordering aur live tracking{version ? ` · v${version}` : ""}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            startApkDownload();
            toast.success("Download shuru ho gaya", {
              description: "Notification panel se APK install karein.",
            });
            dismiss();
          }}
        >
          <Download className="w-4 h-4 mr-1" /> Install
        </Button>

        <button
          aria-label="Band karein"
          onClick={dismiss}
          className="p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
