import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Camera, Loader2, X } from 'lucide-react';
import { getAvatarSignedUrl } from '@/lib/avatarUrl';

interface Props {
  userId: string;
  fullName?: string | null;
  email?: string | null;
  /** Called after avatar_url column is updated (path or null). */
  onChanged?: (newValue: string | null) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Optional image to show when the user has not uploaded a photo yet. */
  fallbackSrc?: string;
}

export default function AvatarUploader({
  userId,
  fullName,
  email,
  onChanged,
  className = '',
  size = 'lg',
  fallbackSrc,
}: Props) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [stored, setStored] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<string>('');

  const sizeCls = size === 'sm' ? 'w-16 h-16' : size === 'md' ? 'w-20 h-20' : 'w-24 h-24';

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', userId)
        .maybeSingle();
      if (!active) return;
      const v = (data as any)?.avatar_url ?? null;
      setStored(v);
      setSignedUrl(await getAvatarSignedUrl(v));
    })();
    return () => { active = false; };
  }, [userId]);

  const initials = (fullName || email || 'U')
    .split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  const upload = async (file: File) => {
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const MAX_BYTES = 8 * 1024 * 1024; // 8 MB raw upload cap
    const prettyMB = (n: number) => (n / (1024 * 1024)).toFixed(1);

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Not an image file',
        description: `"${file.name}" is not an image. Please choose a photo.`,
        variant: 'destructive',
      });
      return;
    }
    if (!ALLOWED.includes(file.type)) {
      toast({
        title: 'Unsupported image format',
        description: `${file.type || 'This format'} is not supported. Use JPG, PNG, WEBP, or GIF.`,
        variant: 'destructive',
      });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({
        title: 'File too large',
        description: `Your image is ${prettyMB(file.size)} MB. Maximum allowed is ${prettyMB(MAX_BYTES)} MB.`,
        variant: 'destructive',
      });
      return;
    }
    if (file.size === 0) {
      toast({
        title: 'Empty file',
        description: 'The selected file is empty or unreadable.',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    setProgress(5);
    setStage('Preparing…');
    try {
      let blob: Blob = file;
      let contentType = 'image/jpeg';
      setStage('Compressing image…');
      setProgress(20);
      let compressionFailed = false;
      try {
        const { compressImage } = await import('@/lib/compressImage');
        blob = await compressImage(file, { maxSize: 512, quality: 0.85, square: true });
      } catch (err: any) {
        compressionFailed = true;
        blob = file;
        contentType = file.type;
        toast({
          title: 'Compression failed',
          description: 'Could not compress the image — uploading the original file instead.',
        });
      }
      setProgress(45);
      setStage('Uploading to server…');
      const path = `${userId}/avatar-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, cacheControl: '3600', contentType });
      if (upErr) {
        toast({
          title: 'Upload failed',
          description: upErr.message || 'Could not upload the image to storage. Check your connection and try again.',
          variant: 'destructive',
        });
        throw upErr;
      }
      setProgress(80);
      setStage('Saving profile…');
      const { error: dbErr } = await supabase
        .from('profiles')
        .update({ avatar_url: path })
        .eq('id', userId);
      if (dbErr) {
        toast({
          title: 'Save failed',
          description: dbErr.message || 'Photo uploaded but profile could not be updated.',
          variant: 'destructive',
        });
        throw dbErr;
      }
      setProgress(100);
      setStage('Done');
      setStored(path);
      setSignedUrl(await getAvatarSignedUrl(path));
      onChanged?.(path);
      toast({
        title: 'Profile picture updated',
        description: compressionFailed ? 'Original photo uploaded (uncompressed).' : undefined,
      });
    } catch (e: any) {
      // Errors already surfaced above; keep this as a safety net.
      if (!e?.message?.toLowerCase().includes('upload') && !e?.message?.toLowerCase().includes('save')) {
        toast({ title: 'Something went wrong', description: e?.message || 'Please try again.', variant: 'destructive' });
      }
    } finally {
      setTimeout(() => {
        setUploading(false);
        setProgress(0);
        setStage('');
      }, 400);
    }
  };

  const remove = async () => {
    setUploading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', userId);
      if (error) throw error;
      setStored(null);
      setSignedUrl(null);
      onChanged?.(null);
      toast({ title: 'Profile picture removed' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <div className="relative">
        <Avatar className={`${sizeCls} border-4 border-background shadow-md`}>
          {(signedUrl || fallbackSrc) && (
            <AvatarImage src={signedUrl || fallbackSrc} alt={fullName || 'Avatar'} className="object-cover" />
          )}
          <AvatarFallback className="text-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        {uploading && (
          <div className="absolute inset-0 rounded-full bg-background/70 flex flex-col items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-[10px] font-semibold text-primary mt-0.5">{progress}%</span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{fullName || 'Your Name'}</p>
        {email && <p className="text-xs text-muted-foreground truncate">{email}</p>}
        <div className="flex flex-wrap gap-2 mt-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = '';
            }}
          />
          <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
            <Camera className="w-4 h-4 mr-1.5" />
            {stored ? 'Change photo' : 'Upload photo'}
          </Button>
          {stored && (
            <Button size="sm" variant="ghost" onClick={remove} disabled={uploading}>
              <X className="w-4 h-4 mr-1.5" /> Remove
            </Button>
          )}
        </div>
        {uploading && (
          <div className="mt-2 space-y-1">
            <Progress value={progress} className="h-1.5" />
            <p className="text-[11px] text-muted-foreground">{stage}</p>
          </div>
        )}
      </div>
    </div>
  );
}
