import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
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

    if (!ALLOWED.includes(file.type)) {
      toast({
        title: 'Unsupported file type',
        description: 'Please choose a JPG, PNG, WEBP, or GIF image.',
        variant: 'destructive',
      });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({
        title: 'File too large',
        description: `Maximum size is ${Math.round(MAX_BYTES / (1024 * 1024))} MB.`,
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      let blob: Blob = file;
      let contentType = 'image/jpeg';
      try {
        const { compressImage } = await import('@/lib/compressImage');
        blob = await compressImage(file, { maxSize: 512, quality: 0.85, square: true });
      } catch {
        // Fallback: upload original if compression fails
        blob = file;
        contentType = file.type;
      }
      const path = `${userId}/avatar-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, cacheControl: '3600', contentType });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase
        .from('profiles')
        .update({ avatar_url: path })
        .eq('id', userId);
      if (dbErr) throw dbErr;
      setStored(path);
      setSignedUrl(await getAvatarSignedUrl(path));
      onChanged?.(path);
      toast({ title: 'Profile picture updated' });
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    } finally {
      setUploading(false);
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
          <div className="absolute inset-0 rounded-full bg-background/70 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
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
      </div>
    </div>
  );
}
