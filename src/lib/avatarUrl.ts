// Shared helpers for the (private) `avatars` storage bucket.
// Avatars are stored as raw storage paths in profiles.avatar_url; we always
// serve them via short-lived signed URLs so any authenticated user in the
// project (customer, rider, restaurant owner, admin) can see them.
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'avatars';
const EXPIRY = 60 * 60; // 1 hour

/** Convert a stored value (path OR legacy public URL) into a storage path. */
export function extractAvatarPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const marker = `/${BUCKET}/`;
  const idx = value.indexOf(marker);
  if (idx >= 0) return value.slice(idx + marker.length).split('?')[0];
  return value;
}

export async function getAvatarSignedUrl(value: string | null | undefined) {
  const path = extractAvatarPath(value);
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, EXPIRY);
  if (error) return null;
  return data.signedUrl;
}

/** Resolves a stored value (path/legacy url) to a fresh signed URL. */
export function useAvatarSignedUrl(value: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setUrl(null);
    if (!value) return;
    getAvatarSignedUrl(value).then((u) => { if (active) setUrl(u); });
    return () => { active = false; };
  }, [value]);
  return url;
}

/** Fetches a user's profile avatar (by user_id) and returns a signed URL. */
export function useProfileAvatar(userId: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setUrl(null);
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', userId)
        .maybeSingle();
      const signed = await getAvatarSignedUrl((data as any)?.avatar_url);
      if (active) setUrl(signed);
    })();
    return () => { active = false; };
  }, [userId]);
  return url;
}
