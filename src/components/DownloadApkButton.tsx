import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
export const DOWNLOAD_ENDPOINT = `https://${PROJECT_ID}.supabase.co/functions/v1/download-apk`;

/** Browser navigation ke bagair APK download start karta hai (hidden iframe). */
export function startApkDownload() {
  const url = `${DOWNLOAD_ENDPOINT}?t=${Date.now()}`;
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.src = url;
  document.body.appendChild(iframe);
  window.setTimeout(() => iframe.remove(), 60_000);

  // Fallback: agar iframe block ho jaye to anchor click
  const a = document.createElement("a");
  a.href = url;
  a.download = "food-xpress.apk";
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  window.setTimeout(() => a.remove(), 1000);
}

type Props = {
  size?: "default" | "sm" | "lg";
  variant?: "default" | "outline" | "secondary" | "ghost";
  className?: string;
  label?: string;
  showVersion?: boolean;
  onDone?: () => void;
};

export default function DownloadApkButton({
  size = "default",
  variant = "default",
  className,
  label = "Download App",
  showVersion = false,
  onDone,
}: Props) {
  const [version, setVersion] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!showVersion) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("app_releases")
        .select("version")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (active && data) setVersion((data as { version: string }).version);
    })();
    return () => {
      active = false;
    };
  }, [showVersion]);

  const handle = () => {
    setBusy(true);
    try {
      startApkDownload();
      toast.success("Download shuru ho gaya", {
        description: "Notification panel mein APK check karein, phir install karein.",
      });
      onDone?.();
    } finally {
      window.setTimeout(() => setBusy(false), 2500);
    }
  };

  return (
    <Button size={size} variant={variant} className={className} onClick={handle} disabled={busy}>
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
      {label}
      {showVersion && version ? ` (v${version})` : ""}
    </Button>
  );
}
