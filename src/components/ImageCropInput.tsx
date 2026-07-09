import { useCallback, useRef, useState } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Crop, Upload, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ImageCropInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  aspect?: number; // default aspect; user can also change in dialog
  previewClassName?: string;
}

const ASPECTS: { label: string; value: number }[] = [
  { label: 'Square 1:1', value: 1 },
  { label: 'Landscape 16:9', value: 16 / 9 },
  { label: 'Card 4:3', value: 4 / 3 },
  { label: 'Cover 3:1', value: 3 },
  { label: 'Portrait 3:4', value: 3 / 4 },
];

async function getCroppedDataUrl(src: string, area: Area, mime = 'image/jpeg'): Promise<string> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load image. The remote URL may block cross-origin access — try uploading the file instead.'));
    img.src = src;
  });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(area.width);
  canvas.height = Math.round(area.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);
  return canvas.toDataURL(mime, 0.9);
}

export default function ImageCropInput({
  value,
  onChange,
  label = 'Image',
  placeholder = 'https://... or upload a file',
  aspect: defaultAspect = 16 / 9,
  previewClassName = 'w-full h-32 object-cover rounded-md border',
}: ImageCropInputProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState<string>('');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState<number>(defaultAspect);
  const [area, setArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const openCropper = (initial: string) => {
    if (!initial) {
      toast({ title: 'Add an image first', description: 'Paste a URL or upload a file.', variant: 'destructive' });
      return;
    }
    setSrc(initial);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setAspect(defaultAspect);
    setOpen(true);
  };

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result as string;
      onChange(data);
      openCropper(data);
    };
    reader.readAsDataURL(file);
  };

  const pickFromDevice = async () => {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { pickImageNative } = await import('@/lib/uploadImage');
        const blob = await pickImageNative();
        if (!blob) return;
        const file = new File([blob], `pic-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
        onFile(file);
        return;
      }
    } catch (e: any) {
      toast({ title: 'Camera error', description: e?.message || 'Could not open camera', variant: 'destructive' });
      return;
    }
    fileRef.current?.click();
  };


  const onCropComplete = useCallback((_: Area, pixels: Area) => setArea(pixels), []);

  const applyCrop = async () => {
    if (!area || !src) return;
    setSaving(true);
    try {
      const cropped = await getCroppedDataUrl(src, area);
      onChange(cropped);
      setOpen(false);
      toast({ title: 'Image cropped' });
    } catch (e: any) {
      toast({ title: 'Crop failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
        <Button type="button" variant="outline" size="icon" onClick={pickFromDevice} title="Upload / Camera">
          <Upload className="w-4 h-4" />
        </Button>
        <Button type="button" variant="outline" size="icon" onClick={() => openCropper(value)} title="Crop & adjust" disabled={!value}>
          <Crop className="w-4 h-4" />
        </Button>
        {value && (
          <Button type="button" variant="outline" size="icon" onClick={() => onChange('')} title="Clear">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
      {value && (
        <img
          src={value}
          alt="Preview"
          className={previewClassName}
          onError={(e) => ((e.target as HTMLImageElement).style.opacity = '0.3')}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crop & adjust image</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative w-full h-80 bg-muted rounded-md overflow-hidden">
              {src && (
                <Cropper
                  image={src}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotation}
                  aspect={aspect}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onRotationChange={setRotation}
                  onCropComplete={onCropComplete}
                />
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs">Aspect</Label>
                <Select value={String(aspect)} onValueChange={(v) => setAspect(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ASPECTS.map(a => <SelectItem key={a.label} value={String(a.value)}>{a.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Zoom</Label>
                <Slider value={[zoom]} min={1} max={4} step={0.05} onValueChange={(v) => setZoom(v[0])} />
              </div>
              <div>
                <Label className="text-xs">Rotation</Label>
                <Slider value={[rotation]} min={0} max={360} step={1} onValueChange={(v) => setRotation(v[0])} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={applyCrop} disabled={saving}>{saving ? 'Applying...' : 'Apply crop'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
