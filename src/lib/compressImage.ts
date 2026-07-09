// Compress + optionally center-crop an image File/Blob to a JPEG Blob.
// Used for avatar & document uploads so users never hit the "image too large" error.

export interface CompressOptions {
  maxSize?: number;      // longest side in px (default 1024)
  quality?: number;      // 0..1 (default 0.85)
  square?: boolean;      // center-crop to square (default false)
  mime?: string;         // output mime (default image/jpeg)
}

export async function compressImage(
  input: File | Blob,
  opts: CompressOptions = {},
): Promise<Blob> {
  const { maxSize = 1024, quality = 0.85, square = false, mime = 'image/jpeg' } = opts;

  const dataUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('Could not read image'));
    r.readAsDataURL(input);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Could not decode image'));
    i.src = dataUrl;
  });

  let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
  if (square) {
    const side = Math.min(sw, sh);
    sx = Math.round((sw - side) / 2);
    sy = Math.round((sh - side) / 2);
    sw = sh = side;
  }

  // Scale down so the longest side <= maxSize
  const scale = Math.min(1, maxSize / Math.max(sw, sh));
  const dw = Math.round(sw * scale);
  const dh = Math.round(sh * scale);

  const canvas = document.createElement('canvas');
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, dw, dh);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Compression failed'))),
      mime,
      quality,
    );
  });
  return blob;
}
