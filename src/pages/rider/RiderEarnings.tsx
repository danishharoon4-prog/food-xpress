import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Wallet, ArrowUpRight, TrendingUp } from 'lucide-react';
import type { RiderWallet, RiderEarning } from '@/types';

export default function RiderEarnings() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<RiderWallet | null>(null);
  const [earnings, setEarnings] = useState<RiderEarning[]>([]);
  const [riderId, setRiderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    const { data: rider } = await supabase
      .from('riders')
      .select('id')
      .eq('user_id', user!.id)
      .maybeSingle();

    if (rider) {
      setRiderId(rider.id);

      const [walletRes, earningsRes] = await Promise.all([
        supabase.from('rider_wallets').select('*').eq('rider_id', rider.id).maybeSingle(),
        supabase.from('rider_earnings').select('*').eq('rider_id', rider.id).order('created_at', { ascending: false }).limit(20),
      ]);

      if (walletRes.data) setWallet(walletRes.data as RiderWallet);
      if (earningsRes.data) setEarnings(earningsRes.data as RiderEarning[]);
    }
    setLoading(false);
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet || !riderId) return;

    const amount = parseFloat(withdrawAmount);
    if (amount > Number(wallet.balance)) {
      toast({ title: 'Error', description: 'Insufficient balance', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('rider_withdrawals').insert({
      rider_id: riderId,
      amount,
      method: withdrawMethod,
      account_details: withdrawMethod === 'easypaisa' ? wallet.easypaisa_number :
                       withdrawMethod === 'jazzcash' ? wallet.jazzcash_number :
                       `${wallet.bank_name} - ${wallet.account_number}`,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Withdrawal request submitted' });
      setDialogOpen(false);
      setWithdrawAmount('');
    }
  };

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Loading earnings...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Wallet Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-primary/10 to-accent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="w-4 h-4" /> Available Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">PKR {Number(wallet?.balance || 0).toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Total Earned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">PKR {Number(wallet?.total_earned || 0).toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Bonus Points</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{wallet?.bonus_points || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Withdraw Button */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button className="gradient-primary">
            <ArrowUpRight className="w-4 h-4 mr-2" /> Withdraw Funds
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw Funds</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleWithdraw} className="space-y-4">
            <div>
              <Label>Amount (PKR)</Label>
              <Input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                max={wallet?.balance}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">Available: PKR {Number(wallet?.balance || 0).toLocaleString()}</p>
            </div>
            <div>
              <Label>Withdraw To</Label>
              <Select value={withdrawMethod} onValueChange={setWithdrawMethod} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {wallet?.easypaisa_number && <SelectItem value="easypaisa">EasyPaisa ({wallet.easypaisa_number})</SelectItem>}
                  {wallet?.jazzcash_number && <SelectItem value="jazzcash">JazzCash ({wallet.jazzcash_number})</SelectItem>}
                  {wallet?.bank_name && <SelectItem value="bank">Bank ({wallet.bank_name})</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full">Submit Request</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Recent Earnings */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Earnings</CardTitle>
        </CardHeader>
        <CardContent>
          {earnings.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No earnings yet. Complete deliveries to earn!</p>
          ) : (
            <div className="space-y-3">
              {earnings.map((earning) => (
                <div key={earning.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium">Delivery Earning</p>
                    <p className="text-xs text-muted-foreground">
                      {earning.distance_km && `${earning.distance_km} km • `}
                      {new Date(earning.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-success">+PKR {Number(earning.amount).toLocaleString()}</p>
                    {earning.bonus_amount > 0 && (
                      <p className="text-xs text-primary">+{earning.bonus_amount} bonus</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
