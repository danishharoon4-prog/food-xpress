import { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ZoomIn, RotateCw, Check, X } from 'lucide-react';

interface Props {
  open: boolean;
  file: File | null;
  onCancel: () => void;
  onConfirm: (croppedBlob: Blob) => void;
}

interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function getCroppedBlob(imageSrc: string, area: Area, rotation: number, outputSize = 512): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  // If rotated, draw onto an intermediate canvas first
  if (rotation) {
    const bBoxW = Math.abs(Math.cos(rotation * Math.PI / 180) * image.width) +
                  Math.abs(Math.sin(rotation * Math.PI / 180) * image.height);
    const bBoxH = Math.abs(Math.sin(rotation * Math.PI / 180) * image.width) +
                  Math.abs(Math.cos(rotation * Math.PI / 180) * image.height);
    const tmp = document.createElement('canvas');
    tmp.width = bBoxW;
    tmp.height = bBoxH;
    const tctx = tmp.getContext('2d')!;
    tctx.translate(bBoxW / 2, bBoxH / 2);
    tctx.rotate((rotation * Math.PI) / 180);
    tctx.drawImage(image, -image.width / 2, -image.height / 2);
    ctx.drawImage(tmp, area.x, area.y, area.width, area.height, 0, 0, outputSize, outputSize);
  } else {
    ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, outputSize, outputSize);
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error('Failed to create image'));
      else resolve(blob);
    }, 'image/jpeg', 0.9);
  });
}

export default function AvatarCropDialog({ open, file, onCancel, onConfirm }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [areaPx, setAreaPx] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  const imageSrc = file ? URL.createObjectURL(file) : null;

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setAreaPx(pixels);
  }, []);

  const handleConfirm = async () => {
    if (!imageSrc || !areaPx) return;
    setProcessing(true);
    try {
      const blob = await getCroppedBlob(imageSrc, areaPx, rotation);
      onConfirm(blob);
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleCancel()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-2">
          <DialogTitle>Adjust your photo</DialogTitle>
        </DialogHeader>

        <div className="relative w-full bg-black" style={{ height: 320 }}>
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={onCropComplete}
            />
          )}
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <ZoomIn className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Zoom</span>
            </div>
            <Slider value={[zoom]} min={1} max={3} step={0.05} onValueChange={(v) => setZoom(v[0])} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <RotateCw className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Rotate</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setRotation((r) => (r + 90) % 360)}
              >
                +90°
              </Button>
            </div>
            <Slider value={[rotation]} min={0} max={360} step={1} onValueChange={(v) => setRotation(v[0])} />
          </div>
        </div>

        <DialogFooter className="px-5 pb-5 gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={processing} className="flex-1">
            <X className="w-4 h-4 mr-1.5" /> Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={processing || !areaPx} className="flex-1">
            <Check className="w-4 h-4 mr-1.5" /> {processing ? 'Processing…' : 'Use photo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
