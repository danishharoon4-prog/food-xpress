import { useState, MouseEvent } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { X, AlertTriangle } from 'lucide-react';
import type { OrderStatus } from '@/types';

interface CancelOrderButtonProps {
  orderId: string;
  status: OrderStatus;
  onCancelled?: () => void;
  size?: 'sm' | 'default' | 'lg' | 'icon';
  variant?: 'destructive' | 'outline' | 'ghost';
  fullWidth?: boolean;
  label?: string;
}

const CANCELLABLE: OrderStatus[] = ['pending', 'confirmed'];

const PRESET_REASONS = [
  'Ordered by mistake',
  'Changed my mind',
  'Wrong delivery address',
  'Taking too long',
  'Found a better option',
  'Duplicate order',
];

export function CancelOrderButton({
  orderId,
  status,
  onCancelled,
  size = 'sm',
  variant = 'outline',
  fullWidth = false,
  label = 'Cancel Order',
}: CancelOrderButtonProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!CANCELLABLE.includes(status)) return null;

  // Only stop propagation — DO NOT call preventDefault, because Radix's
  // composeEventHandlers skips its own onClick when defaultPrevented, which
  // would prevent the AlertDialog from opening when nested inside a <Link>.
  const stop = (e: MouseEvent) => {
    e.stopPropagation();
  };
  const stopNav = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const finalReason = [preset, note.trim()].filter(Boolean).join(preset && note.trim() ? ' — ' : '');

  const submit = async () => {
    if (!finalReason) {
      toast({ title: 'Reason required', description: 'Pick a reason or add a note.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc('cancel_order', { _order_id: orderId, _reason: finalReason });
    setSubmitting(false);
    if (error) {
      toast({ title: 'Could not cancel', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Order cancelled', description: 'Your order has been cancelled.' });
    setOpen(false);
    setPreset(null);
    setNote('');
    onCancelled?.();
  };

  return (
    <span onClick={stopNav} className={fullWidth ? 'w-full inline-block' : 'inline-block'}>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            size={size}
            variant={variant}
            onClick={stop}
            className={`${fullWidth ? 'w-full' : ''} ${variant === 'outline' ? 'text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive' : ''}`}
          >
            <X className="w-4 h-4 mr-1" />
            {label}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Cancel this order?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Orders can only be cancelled before they enter preparation. Pick a reason below — it will be shared with the admin team.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium mb-2">Reason</p>
              <div className="flex flex-wrap gap-2">
                {PRESET_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setPreset(preset === r ? null : r)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition ${
                      preset === r
                        ? 'bg-destructive text-destructive-foreground border-destructive'
                        : 'bg-background text-foreground border-border hover:border-destructive/40 hover:bg-destructive/5'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">
                Add a note <span className="text-muted-foreground font-normal">(optional)</span>
              </p>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Share more details so we can improve..."
                rows={3}
                maxLength={300}
              />
              <p className="text-[11px] text-muted-foreground mt-1 text-right">{note.length}/300</p>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting} onClick={stop}>Keep Order</AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting || !finalReason}
              onClick={(e) => { stop(e); submit(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting ? 'Cancelling...' : 'Confirm Cancel'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </span>
  );
}
