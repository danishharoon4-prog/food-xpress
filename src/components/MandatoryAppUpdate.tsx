import { useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Download, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { requiresAppUpdate } from '@/lib/appUpdatePolicy';
import { Button } from '@/components/ui/button';
import { DOWNLOAD_ENDPOINT } from '@/components/DownloadApkButton';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription,
} from '@/components/ui/alert-dialog';

type RequiredRelease = { id: string; version: string; version_code: number | null; release_notes: string | null };

export default function MandatoryAppUpdate() {
  const [required, setRequired] = useState<RequiredRelease | null>(null);
  const [installedVersion, setInstalledVersion] = useState('');
  const [checking, setChecking] = useState(false);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [checkAgain, setCheckAgain] = useState(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;
    let active = true;
    let pending = false;
    const check = async () => {
      if (pending || document.visibilityState === 'hidden') return;
      pending = true;
      if (active) setChecking(true);
      try {
        const info = await CapacitorApp.getInfo();
        const { data, error } = await supabase.from('app_releases')
          .select('id, version, version_code, release_notes')
          .eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (!active || error) return;
        setInstalledVersion(info.version);
        setRequired(data && requiresAppUpdate(info.build, data.version_code) ? data : null);
      } catch {
        // Keep a previously confirmed requirement; first-time offline checks retry later.
      } finally {
        pending = false;
        if (active) setChecking(false);
      }
    };
    void check();
    const interval = window.setInterval(() => void check(), 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') void check(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    const listener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void check();
    });
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
      void listener.then(handle => handle.remove());
    };
  }, [checkAgain]);

  return (
    <AlertDialog open={required !== null}>
      <AlertDialogContent className="z-[10000] max-w-sm max-h-[85dvh] overflow-y-auto"
        onEscapeKeyDown={event => event.preventDefault()}>
        <AlertDialogHeader>
          <img src="/icon-192.png" alt="Food Xpress" className="mx-auto h-16 w-16 rounded-lg" />
          <AlertDialogTitle>App update zaroori hai</AlertDialogTitle>
          <AlertDialogDescription>
            Food Xpress v{required?.version} aa gaya hai. Aapka version v{installedVersion} hai.
            App istemal jari rakhne ke liye naya version install karein.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {required?.release_notes && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{required.release_notes}</p>}
        <Button asChild onClick={() => setDownloadStarted(true)}>
          <a href={`${DOWNLOAD_ENDPOINT}?id=${encodeURIComponent(required?.id ?? '')}&t=${Date.now()}`}
            target="_blank" rel="noopener noreferrer">
            <Download className="mr-2 h-4 w-4" /> Update Now
          </a>
        </Button>
        {downloadStarted && (
          <p role="status" className="text-sm text-muted-foreground">
            Download hui APK kholein, Android mein Install ki ijazat dein, phir app dobara kholein.
            Sirf download karne se update mukammal nahi hota.
          </p>
        )}
        <Button variant="outline" disabled={checking} onClick={() => setCheckAgain(value => value + 1)}>
          <RefreshCw className={`mr-2 h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
          {checking ? 'Checking…' : 'Check Installed Version'}
        </Button>
      </AlertDialogContent>
    </AlertDialog>
  );
}