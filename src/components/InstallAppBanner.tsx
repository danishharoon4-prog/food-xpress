import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download, X, Smartphone, Share, Plus } from "lucide-react";
import { startApkDownload } from "@/components/DownloadApkButton";
import { toast } from "sonner";

const DISMISS_KEY = "fx_apk_banner_dismissed_at";
const IOS_DISMISS_KEY = "fx_ios_banner_dismissed_at";
const DISMISS_MS = 1000 * 60 * 60 * 24 * 3; // 3 days


const isCapacitor = () =>
  typeof window !== "undefined" &&
  (!!(window as any).Capacitor?.isNativePlatform?.() ||
    navigator.userAgent.includes("FoodXpressApp"));

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  (navigator as any).standalone === true;

const isIOS = () => {
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1)
  );
};

export default function InstallAppBanner() {
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);
  const [iosSteps, setIosSteps] = useState(false);
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    // Browser ka apna PWA "Add to Home screen" prompt band — hum apni APK offer dete hain
    const block = (e: Event) => e.preventDefault();
    window.addEventListener("beforeinstallprompt", block);

    const cleanup = () => window.removeEventListener("beforeinstallprompt", block);

    if (isCapacitor() || isStandalone()) return cleanup;

    // iOS: Safari me koi install prompt nahi hota — manual "Add to Home Screen" guide
    if (isIOS()) {
      const dismissedAt = Number(localStorage.getItem(IOS_DISMISS_KEY) || 0);
      if (Date.now() - dismissedAt < DISMISS_MS) return cleanup;
      setIos(true);
      setShow(true);
      return cleanup;
    }

    const isAndroid = /Android/i.test(navigator.userAgent);
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    const recentlyDismissed = Date.now() - dismissedAt < DISMISS_MS;

    if (!isAndroid || recentlyDismissed) return cleanup;

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
      cleanup();
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(ios ? IOS_DISMISS_KEY : DISMISS_KEY, String(Date.now()));
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-md rounded-2xl border bg-card shadow-2xl p-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center">
            <Smartphone className="w-6 h-6 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight">
              {ios ? "Home screen par app add karein" : "Food Xpress App install karein"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {ios
                ? "Safari se 1 tap me app jaisa experience"
                : `Tez ordering aur live tracking${version ? ` · v${version}` : ""}`}
            </p>
          </div>

          {ios ? (
            <Button size="sm" onClick={() => setIosSteps((v) => !v)}>
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          ) : (
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
          )}

          <button
            aria-label="Band karein"
            onClick={dismiss}
            className="p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {ios && iosSteps && (
          <ol className="mt-3 space-y-2 border-t pt-3 text-xs text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="font-semibold text-foreground">1.</span>
              Safari me neeche
              <Share className="w-4 h-4 text-primary" />
              <b className="text-foreground">Share</b> button tap karein
            </li>
            <li className="flex items-center gap-2">
              <span className="font-semibold text-foreground">2.</span>
              <b className="text-foreground">Add to Home Screen</b> chunein
            </li>
            <li className="flex items-center gap-2">
              <span className="font-semibold text-foreground">3.</span>
              <b className="text-foreground">Add</b> tap karein — app icon ban jayega
            </li>
          </ol>
        )}
      </div>
    </div>
  );
}
