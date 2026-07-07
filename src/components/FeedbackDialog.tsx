import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  orderId: string;
  riderId: string | null;
  restaurantId: string | null;
  alreadyRated?: boolean;
  onRated?: () => void;
  /** Controlled mode: when provided, hide the trigger button */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)}>
          <Star className={cn('w-7 h-7 transition-colors', n <= value ? 'fill-warning text-warning' : 'text-muted-foreground')} />
        </button>
      ))}
    </div>
  );
}

export default function FeedbackDialog({
  orderId, riderId, restaurantId, alreadyRated, onRated,
  open: openProp, onOpenChange, hideTrigger,
}: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [openState, setOpenState] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : openState;
  const setOpen = (v: boolean) => {
    if (!isControlled) setOpenState(v);
    onOpenChange?.(v);
  };
  const [food, setFood] = useState(0);
  const [rider, setRider] = useState(0);
  const [resto, setResto] = useState(0);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (food === 0 && rider === 0 && resto === 0) {
      return toast({ title: 'Please rate at least one', variant: 'destructive' });
    }
    setSaving(true);
    const { error } = await supabase.from('ratings').insert({
      order_id: orderId,
      customer_id: user!.id,
      rider_id: riderId,
      restaurant_id: restaurantId,
      food_rating: food || null,
      rider_rating: rider || null,
      restaurant_rating: resto || null,
      review_text: text || null,
    });
    setSaving(false);
    if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    toast({ title: 'Thanks for your feedback!' });
    setOpen(false);
    onRated?.();
  };

  if (alreadyRated && !isControlled) {
    return <Button variant="ghost" size="sm" disabled className="h-7 text-xs"><Star className="w-3 h-3 mr-1 fill-warning text-warning" />Rated</Button>;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 text-xs"><Star className="w-3 h-3 mr-1" />Rate</Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Rate your experience</DialogTitle></DialogHeader>
        <div className="space-y-5">
          <div>
            <Label className="text-sm">Food quality</Label>
            <StarPicker value={food} onChange={setFood} />
          </div>
          {restaurantId && (
            <div>
              <Label className="text-sm">Restaurant service</Label>
              <StarPicker value={resto} onChange={setResto} />
            </div>
          )}
          {riderId && (
            <div>
              <Label className="text-sm">Rider</Label>
              <StarPicker value={rider} onChange={setRider} />
            </div>
          )}
          <div>
            <Label className="text-sm">Comments (optional)</Label>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Share your experience..." />
          </div>
          <Button onClick={submit} disabled={saving} className="w-full gradient-primary">
            {saving ? 'Submitting...' : 'Submit Feedback'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
