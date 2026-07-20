import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  factorId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function MfaChallengeDialog({ open, factorId, onSuccess, onCancel }: Props) {
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !factorId) return;
    (async () => {
      const { data, error } = await supabase.auth.mfa.challenge({ factorId });
      if (error) { toast.error(error.message); return; }
      setChallengeId(data.id);
    })();
  }, [open, factorId]);

  const verify = async () => {
    if (!challengeId) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code: code.trim() });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" /> Two-factor verification
          </DialogTitle>
          <DialogDescription>
            Open your authenticator app and enter the 6-digit code.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Authentication code</Label>
          <Input
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={verify} disabled={busy || code.length !== 6 || !challengeId}>
            {busy && <Loader2 className="animate-spin w-4 h-4 mr-2" />}
            Verify
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
