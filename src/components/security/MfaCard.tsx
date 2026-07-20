import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Factor { id: string; friendly_name?: string; factor_type: string; status: string }

export default function MfaCard() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollData, setEnrollData] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.totp || []) as Factor[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const startEnroll = async () => {
    setEnrolling(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    setEnrolling(false);
    if (error) { toast.error(error.message); return; }
    setEnrollData({
      factorId: data.id,
      qr: data.totp.qr_code,
      secret: data.totp.secret,
    });
  };

  const verifyEnroll = async () => {
    if (!enrollData) return;
    setVerifying(true);
    const { data: chal, error: cErr } = await supabase.auth.mfa.challenge({ factorId: enrollData.factorId });
    if (cErr || !chal) { setVerifying(false); toast.error(cErr?.message || 'Challenge failed'); return; }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId: enrollData.factorId,
      challengeId: chal.id,
      code: verifyCode.trim(),
    });
    setVerifying(false);
    if (vErr) { toast.error(vErr.message); return; }
    toast.success('Two-factor authentication enabled');
    setEnrollData(null);
    setVerifyCode('');
    load();
  };

  const disable = async (factorId: string) => {
    if (!confirm('Disable two-factor authentication?')) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) { toast.error(error.message); return; }
    toast.success('Two-factor authentication disabled');
    load();
  };

  const active = factors.find(f => f.status === 'verified');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {active ? <ShieldCheck className="w-5 h-5 text-green-600" /> : <ShieldAlert className="w-5 h-5 text-amber-500" />}
          Two-Factor Authentication
        </CardTitle>
        <CardDescription>
          Add an extra layer of security using an authenticator app like Google Authenticator or Authy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <Loader2 className="animate-spin w-5 h-5" />
        ) : active ? (
          <div className="flex items-center justify-between gap-3">
            <Badge variant="secondary" className="gap-1"><ShieldCheck className="w-3 h-3" /> Enabled</Badge>
            <Button variant="outline" size="sm" onClick={() => disable(active.id)}>Disable</Button>
          </div>
        ) : (
          <Button onClick={startEnroll} disabled={enrolling}>
            {enrolling && <Loader2 className="animate-spin w-4 h-4 mr-2" />}
            Enable 2FA
          </Button>
        )}
      </CardContent>

      <Dialog open={!!enrollData} onOpenChange={(o) => { if (!o) { setEnrollData(null); setVerifyCode(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scan QR code</DialogTitle>
            <DialogDescription>
              Open Google Authenticator, Authy, or 1Password and scan this QR code. Then enter the 6-digit code below.
            </DialogDescription>
          </DialogHeader>
          {enrollData && (
            <div className="space-y-4">
              <div className="flex justify-center bg-white p-4 rounded-lg">
                <img src={enrollData.qr} alt="MFA QR" className="w-48 h-48" />
              </div>
              <div className="text-xs text-center text-muted-foreground break-all">
                Or enter manually: <code className="font-mono">{enrollData.secret}</code>
              </div>
              <div className="space-y-2">
                <Label>6-digit code</Label>
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEnrollData(null); setVerifyCode(''); }}>Cancel</Button>
            <Button onClick={verifyEnroll} disabled={verifying || verifyCode.length !== 6}>
              {verifying && <Loader2 className="animate-spin w-4 h-4 mr-2" />}
              Verify & Enable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
