import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

export type UploadBucket = 'avatars' | 'rider-documents' | 'support-attachments';

/**
 * Pick an image from camera or gallery (native), or from a File input (web).
 * Returns a Blob you can pass to uploadImage().
 */
export async function pickImageNative(): Promise<Blob | null> {
  if (!Capacitor.isNativePlatform()) return null;
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
  const perm = await Camera.checkPermissions();
  if (perm.camera !== 'granted' || perm.photos !== 'granted') {
    await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
  }
  const photo = await Camera.getPhoto({
    quality: 80,
    allowEditing: false,
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Prompt,
    saveToGallery: false,
    correctOrientation: true,
  });
  if (!photo.dataUrl) return null;
  const res = await fetch(photo.dataUrl);
  return await res.blob();
}

/**
 * Upload a file/blob to a Supabase Storage bucket at `<userId>/<filename>`.
 * Returns { path, signedUrl } — always uses signed URLs (buckets are private).
 */
export async function uploadImage(
  bucket: UploadBucket,
  file: Blob,
  userId: string,
  filenameHint = 'image.jpg'
): Promise<{ path: string; signedUrl: string }> {
  const ext = (filenameHint.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || 'image/jpeg',
    upsert: false,
  });
  if (upErr) throw new Error(upErr.message);

  const { data: signed, error: sigErr } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (sigErr) throw new Error(sigErr.message);
  return { path, signedUrl: signed.signedUrl };
}
