import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, Share2, Trash2, CheckCircle2, Copy, QrCode, Download } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";

type Release = {
  id: string;
  version: string;
  file_path: string;
  file_size: number | null;
  release_notes: string | null;
  is_active: boolean;
  created_at: string;
};

const formatSize = (bytes: number | null) => {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
};

export default function AdminAppReleases() {
  const { user } = useAuth();
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [shareOpen, setShareOpen] = useState<Release | null>(null);

  const downloadUrl = `${window.location.origin}/download`;

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("app_releases")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setReleases((data ?? []) as Release[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleUpload = async () => {
    if (!file || !version.trim()) {
      toast.error("Version aur APK file dono zaroori hain");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".apk")) {
      toast.error("Sirf .apk file allowed hai");
      return;
    }
    setUploading(true);
    try {
      const path = `releases/${Date.now()}-${version.trim()}.apk`;
      const { error: upErr } = await supabase.storage
        .from("app-releases")
        .upload(path, file, { contentType: "application/vnd.android.package-archive" });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("app_releases").insert({
        version: version.trim(),
        file_path: path,
        file_size: file.size,
        release_notes: notes.trim() || null,
        is_active: releases.length === 0,
        uploaded_by: user?.id,
      });
      if (insErr) throw insErr;

      toast.success("APK upload ho gayi");
      setVersion("");
      setNotes("");
      setFile(null);
      (document.getElementById("apk-input") as HTMLInputElement | null)?.value &&
        ((document.getElementById("apk-input") as HTMLInputElement).value = "");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const setActive = async (r: Release) => {
    const { error: e1 } = await supabase.from("app_releases").update({ is_active: false }).neq("id", r.id);
    if (e1) return toast.error(e1.message);
    const { error: e2 } = await supabase.from("app_releases").update({ is_active: true }).eq("id", r.id);
    if (e2) return toast.error(e2.message);
    toast.success(`v${r.version} ab active hai`);
    load();
  };

  const remove = async (r: Release) => {
    if (!confirm(`Delete v${r.version}?`)) return;
    await supabase.storage.from("app-releases").remove([r.file_path]);
    const { error } = await supabase.from("app_releases").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copy ho gaya");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" /> Upload New APK
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Version (e.g. 1.2.0)</Label>
            <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.0.0" />
          </div>
          <div className="grid gap-2">
            <Label>Release Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What's new?" />
          </div>
          <div className="grid gap-2">
            <Label>APK File</Label>
            <Input
              id="apk-input"
              type="file"
              accept=".apk,application/vnd.android.package-archive"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && <p className="text-xs text-muted-foreground">{file.name} — {formatSize(file.size)}</p>}
          </div>
          <Button onClick={handleUpload} disabled={uploading} className="w-full sm:w-auto">
            {uploading ? "Uploading..." : "Upload APK"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Releases</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : releases.length === 0 ? (
            <p className="text-sm text-muted-foreground">Abhi tak koi release upload nahi hui.</p>
          ) : (
            <div className="space-y-3">
              {releases.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-3 p-3 border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">v{r.version}</span>
                      {r.is_active && <Badge variant="default"><CheckCircle2 className="w-3 h-3 mr-1" />Active</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatSize(r.file_size)} • {new Date(r.created_at).toLocaleString()}
                    </p>
                    {r.release_notes && <p className="text-sm mt-1">{r.release_notes}</p>}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {!r.is_active && (
                      <Button size="sm" variant="outline" onClick={() => setActive(r)}>Set Active</Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setShareOpen(r)}>
                      <Share2 className="w-4 h-4 mr-1" /> Share
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(r)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!shareOpen} onOpenChange={(o) => !o && setShareOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Share App Download</DialogTitle>
          </DialogHeader>
          {shareOpen && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 p-4 bg-white rounded-lg">
                <QRCodeCanvas value={downloadUrl} size={200} includeMargin />
                <p className="text-xs text-center text-muted-foreground">
                  Scan karke APK download karein
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input readOnly value={downloadUrl} />
                <Button size="icon" variant="outline" onClick={() => copyLink(downloadUrl)}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => {
                    const text = `Food Xpress Android App download karein: ${downloadUrl}`;
                    if (navigator.share) navigator.share({ title: "Food Xpress App", text, url: downloadUrl });
                    else {
                      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
                    }
                  }}
                >
                  <Share2 className="w-4 h-4 mr-2" /> Share
                </Button>
                <Button variant="outline" className="flex-1" asChild>
                  <a href={downloadUrl} target="_blank" rel="noreferrer">
                    <Download className="w-4 h-4 mr-2" /> Preview
                  </a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
