import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Share2, Smartphone, ShieldCheck } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";

type Release = {
  id: string;
  version: string;
  file_size: number | null;
  release_notes: string | null;
  created_at: string;
};

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
const DOWNLOAD_ENDPOINT = `https://${PROJECT_ID}.supabase.co/functions/v1/download-apk`;

export default function DownloadApp() {
  const [release, setRelease] = useState<Release | null>(null);
  const [loading, setLoading] = useState(true);
  const pageUrl = `${window.location.origin}/download`;

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_releases")
        .select("id, version, file_size, release_notes, created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setRelease(data as Release | null);
      setLoading(false);
    })();
  }, []);

  const share = async () => {
    const text = `Food Xpress Android App abhi download karein: ${pageUrl}`;
    if (navigator.share) {
      try { await navigator.share({ title: "Food Xpress App", text, url: pageUrl }); } catch {}
    } else {
      navigator.clipboard.writeText(pageUrl);
      toast.success("Link copy ho gaya");
    }
  };

  const sizeMb = release?.file_size ? (release.file_size / 1024 / 1024).toFixed(2) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full shadow-xl">
        <CardContent className="p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-2">
              <Smartphone className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Food Xpress Android App</h1>
            <p className="text-sm text-muted-foreground">
              Faster ordering, live tracking aur exclusive deals.
            </p>
          </div>

          {loading ? (
            <p className="text-center text-sm text-muted-foreground">Loading...</p>
          ) : !release ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">Abhi koi release available nahi. Baad mein try karein.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center gap-3 p-4 bg-white rounded-xl border">
                <QRCodeCanvas value={DOWNLOAD_ENDPOINT} size={200} includeMargin />
                <p className="text-xs text-muted-foreground">Phone se QR scan karein</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center text-sm">
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-xs text-muted-foreground">Version</p>
                  <p className="font-semibold">v{release.version}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-xs text-muted-foreground">Size</p>
                  <p className="font-semibold">{sizeMb ? `${sizeMb} MB` : "—"}</p>
                </div>
              </div>

              {release.release_notes && (
                <div className="p-3 rounded-lg border bg-card">
                  <p className="text-xs font-semibold mb-1">What's new</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{release.release_notes}</p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <Button size="lg" className="flex-1" asChild>
                  <a href={DOWNLOAD_ENDPOINT}>
                    <Download className="w-5 h-5 mr-2" /> Download APK
                  </a>
                </Button>
                <Button size="lg" variant="outline" className="flex-1" onClick={share}>
                  <Share2 className="w-5 h-5 mr-2" /> Share
                </Button>
              </div>

              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  Android par install karne ke liye phone settings mein <b>"Unknown sources"</b> allow karna hoga.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
