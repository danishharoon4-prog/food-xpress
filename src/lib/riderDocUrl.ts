import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'rider-documents';

/** Extract the storage path from either a raw path or a legacy public URL. */
export function extractRiderDocPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const marker = `/${BUCKET}/`;
  const idx = value.indexOf(marker);
  if (idx >= 0) return value.slice(idx + marker.length).split('?')[0];
  return value;
}

/** Get a short-lived signed URL for a rider document (path or legacy URL). */
export async function getRiderDocSignedUrl(value: string | null | undefined, expiresInSec = 300) {
  const path = extractRiderDocPath(value);
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSec);
  if (error) return null;
  return data.signedUrl;
}

/** React hook: resolves any stored value to a fresh signed URL. */
export function useRiderDocSignedUrl(value: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setUrl(null);
    if (!value) return;
    getRiderDocSignedUrl(value).then((u) => {
      if (active) setUrl(u);
    });
    return () => {
      active = false;
    };
  }, [value]);
  return url;
}
