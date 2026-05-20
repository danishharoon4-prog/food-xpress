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
import { X } from 'lucide-react';
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
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!CANCELLABLE.includes(status)) return null;

  const stop = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const submit = async () => {
    if (!reason.trim()) {
      toast({ title: 'Reason required', description: 'Please tell us why you are cancelling.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc('cancel_order', { _order_id: orderId, _reason: reason.trim() });
    setSubmitting(false);
    if (error) {
      toast({ title: 'Could not cancel', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Order cancelled', description: 'Your order has been cancelled.' });
    setOpen(false);
    setReason('');
    onCancelled?.();
  };

  return (
    <span onClick={stop} onMouseDown={stop} className={fullWidth ? 'w-full inline-block' : 'inline-block'}>
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          size={size}
          variant={variant}
          className={`${fullWidth ? 'w-full' : ''} ${variant === 'outline' ? 'text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive' : ''}`}
        >
          <X className="w-4 h-4 mr-1" />
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent onClick={stop}>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
          <AlertDialogDescription>
            Orders can only be cancelled before they enter preparation. Please provide a reason — it will be shared with the admin team.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Ordered by mistake, changed my mind, wrong address..."
          rows={4}
          className="mt-2"
        />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting} onClick={stop}>Keep Order</AlertDialogCancel>
          <AlertDialogAction
            disabled={submitting || !reason.trim()}
            onClick={(e) => { stop(e); submit(); }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {submitting ? 'Cancelling...' : 'Confirm Cancel'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
