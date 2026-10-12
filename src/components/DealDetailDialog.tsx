import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Utensils, Check, Store } from 'lucide-react';
import { resolveImg } from '@/lib/img';

export interface DealLike {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  discount_price?: number | null;
  deal_label?: string | null;
  image_url?: string | null;
  restaurant_id: string;
  restaurant_name?: string;
  sizes?: { name: string; price: number }[] | null;
}

const discountPercent = (item: DealLike) =>
  item.discount_price && Number(item.price) > 0
    ? Math.round(((Number(item.price) - Number(item.discount_price)) / Number(item.price)) * 100)
    : 0;

/** Split a combo description like "2 Small Pizzas + 1 Drink. Perfect combo." into its items. */
const parseIncluded = (desc: string | null | undefined): { items: string[]; note: string | null } => {
  if (!desc) return { items: [], note: null };
  const firstSentence = desc.split('.')[0].trim();
  const note = desc.slice(firstSentence.length + 1).trim() || null;
  if (firstSentence.includes('+')) {
    const items = firstSentence
      .split('+')
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length >= 2) return { items, note };
  }
  return { items: [], note: desc.trim() };
};

interface DealDetailDialogProps {
  item: DealLike | null;
  onOpenChange: (open: boolean) => void;
  onAdd: (item: DealLike, size?: { name: string; price: number }) => void;
}

export default function DealDetailDialog({ item, onOpenChange, onAdd }: DealDetailDialogProps) {
  const [pickedSize, setPickedSize] = useState<string>('');

  // Reset the selected size whenever a new deal opens
  useEffect(() => {
    if (item?.sizes?.length) setPickedSize(item.sizes[0].name);
    else setPickedSize('');
  }, [item]);

  if (!item) return null;
  const included = parseIncluded(item.description);
  const hasSizes = Array.isArray(item.sizes) && item.sizes.length > 0;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6">{item.name}</DialogTitle>
        </DialogHeader>
        <div className="relative overflow-hidden rounded-lg aspect-[4/3] bg-gradient-to-br from-primary/10 to-accent/40">
          {item.image_url ? (
            <img
              src={resolveImg(item.image_url)}
              alt={item.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Utensils className="w-10 h-10 text-primary/40" />
            </div>
          )}
          {item.discount_price != null && discountPercent(item) > 0 && (
            <div className="absolute top-3 left-3 bg-destructive text-destructive-foreground text-[11px] font-extrabold tracking-wide px-3 py-1 rounded-full">
              -{discountPercent(item)}%
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {item.deal_label && <Badge variant="destructive" className="w-fit">{item.deal_label}</Badge>}
          {item.restaurant_name && (
            <Link
              to={`/restaurant/${item.restaurant_id}`}
              onClick={() => onOpenChange(false)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors"
            >
              <Store className="w-3.5 h-3.5" /> {item.restaurant_name}
            </Link>
          )}
        </div>

        {included.items.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-bold">What's in this deal:</p>
            <ul className="space-y-1.5">
              {included.items.map((entry, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="w-4 h-4 text-primary mt-0.5 flex-none" strokeWidth={3} />
                  <span>{entry}</span>
                </li>
              ))}
            </ul>
            {included.note && <p className="text-xs text-muted-foreground italic">{included.note}</p>}
          </div>
        )}

        {included.items.length === 0 && included.note && (
          <p className="text-sm text-muted-foreground">{included.note}</p>
        )}

        {hasSizes && (
          <div className="space-y-2">
            <p className="text-sm font-bold">Choose size:</p>
            {item.sizes!.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => setPickedSize(s.name)}
                className={`w-full text-left flex items-center justify-between rounded-lg border px-4 py-3 transition ${
                  pickedSize === s.name
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <span className="font-medium">{s.name}</span>
                <span className="font-bold text-primary">PKR {Number(s.price).toLocaleString()}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          {item.discount_price != null ? (
            <>
              <span className="text-xl font-extrabold text-primary">
                PKR {Number(item.discount_price).toLocaleString()}
              </span>
              <span className="text-sm text-muted-foreground line-through font-medium">
                PKR {Number(item.price).toLocaleString()}
              </span>
            </>
          ) : (
            <span className="text-xl font-extrabold text-primary">
              PKR {Number(item.price).toLocaleString()}
            </span>
          )}
        </div>

        <Button
          className="w-full gradient-primary"
          onClick={() => {
            const size = hasSizes ? item.sizes!.find((s) => s.name === pickedSize) : undefined;
            onAdd(item, size);
          }}
        >
          Add to Cart
        </Button>
      </DialogContent>
    </Dialog>
  );
}
