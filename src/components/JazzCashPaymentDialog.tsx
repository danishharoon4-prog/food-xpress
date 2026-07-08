import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wallet, ShieldCheck } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber?: string;
  amount: number;
  purpose?: 'order' | 'ad_campaign';
  onSuccess: () => void;
  onFailure?: (message: string) => void;
}

export function JazzCashPaymentDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  amount,
  purpose = 'order',
  onSuccess,
  onFailure,
}: Props) {
  const { toast } = useToast();
  const [mobile, setMobile] = useState('');
  const [cnic, setCnic] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    if (!/^03\d{9}$/.test(mobile)) {
      toast({
        title: 'Invalid mobile number',
        description: 'Enter 11-digit JazzCash number starting with 03',
        variant: 'destructive',
      });
      return;
    }
    if (!/^\d{6}$/.test(cnic)) {
      toast({
        title: 'Invalid CNIC',
        description: 'Enter last 6 digits of your CNIC',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('jazzcash-mwallet', {
        body: {
          order_id: orderId,
          mobile_number: mobile,
          cnic,
          purpose,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'Payment Successful ✓',
          description: `Transaction ID: ${data.transaction_id}`,
        });
        onSuccess();
        onOpenChange(false);
      } else {
        const msg = data?.message || 'Payment failed. Please try again.';
        toast({ title: 'Payment Failed', description: msg, variant: 'destructive' });
        onFailure?.(msg);
      }
    } catch (err: any) {
      const msg = err?.message || 'Payment could not be processed';
      toast({ title: 'Payment Error', description: msg, variant: 'destructive' });
      onFailure?.(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !loading && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Pay with JazzCash
          </DialogTitle>
          <DialogDescription>
            {orderNumber ? `Order #${orderNumber} · ` : ''}
            Amount: <span className="font-bold text-primary">PKR {amount.toLocaleString()}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="jc-mobile">JazzCash Mobile Number</Label>
            <Input
              id="jc-mobile"
              placeholder="03XXXXXXXXX"
              value={mobile}
              maxLength={11}
              inputMode="numeric"
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="jc-cnic">CNIC (last 6 digits)</Label>
            <Input
              id="jc-cnic"
              placeholder="e.g. 345678"
              value={cnic}
              maxLength={6}
              inputMode="numeric"
              onChange={(e) => setCnic(e.target.value.replace(/\D/g, ''))}
              disabled={loading}
            />
          </div>

          <div className="flex items-start gap-2 rounded-md bg-accent/50 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <span>
              Your JazzCash wallet will be debited securely. You may receive an OTP/MPIN prompt on your
              registered mobile.
            </span>
          </div>

          <Button
            onClick={handlePay}
            disabled={loading}
            className="w-full h-11 gradient-primary"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing Payment...
              </>
            ) : (
              `Pay PKR ${amount.toLocaleString()}`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
