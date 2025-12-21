import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { Rider, RiderWallet } from '@/types';

export default function RiderSettings() {
  const { user, profile } = useAuth();
  const [rider, setRider] = useState<Rider | null>(null);
  const [wallet, setWallet] = useState<RiderWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Form state
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [cnic, setCnic] = useState('');
  const [easypaisaNumber, setEasypaisaNumber] = useState('');
  const [jazzcashNumber, setJazzcashNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountTitle, setAccountTitle] = useState('');

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    const { data: riderData } = await supabase
      .from('riders')
      .select('*')
      .eq('user_id', user!.id)
      .maybeSingle();

    if (riderData) {
      setRider(riderData as Rider);
      setVehicleType(riderData.vehicle_type || '');
      setVehicleNumber(riderData.vehicle_number || '');
      setCnic(riderData.cnic || '');

      const { data: walletData } = await supabase
        .from('rider_wallets')
        .select('*')
        .eq('rider_id', riderData.id)
        .maybeSingle();

      if (walletData) {
        setWallet(walletData as RiderWallet);
        setEasypaisaNumber(walletData.easypaisa_number || '');
        setJazzcashNumber(walletData.jazzcash_number || '');
        setBankName(walletData.bank_name || '');
        setAccountNumber(walletData.account_number || '');
        setAccountTitle(walletData.account_title || '');
      }
    }
    setLoading(false);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rider) return;

    const { error } = await supabase
      .from('riders')
      .update({
        vehicle_type: vehicleType,
        vehicle_number: vehicleNumber,
        cnic,
      })
      .eq('id', rider.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Saved', description: 'Profile updated successfully' });
    }
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet) return;

    const { error } = await supabase
      .from('rider_wallets')
      .update({
        easypaisa_number: easypaisaNumber || null,
        jazzcash_number: jazzcashNumber || null,
        bank_name: bankName || null,
        account_number: accountNumber || null,
        account_title: accountTitle || null,
      })
      .eq('id', wallet.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Saved', description: 'Payment details updated' });
    }
  };

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold">Settings</h2>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Rider Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <Label>Full Name</Label>
              <Input value={profile?.full_name || ''} disabled />
            </div>
            <div>
              <Label>CNIC</Label>
              <Input value={cnic} onChange={(e) => setCnic(e.target.value)} placeholder="12345-1234567-1" />
            </div>
            <div>
              <Label>Vehicle Type</Label>
              <Input value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} placeholder="Bike / Motorcycle" />
            </div>
            <div>
              <Label>Vehicle Number</Label>
              <Input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="ABC-123" />
            </div>
            <Button type="submit">Save Profile</Button>
          </form>
        </CardContent>
      </Card>

      {/* Payment Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSavePayment} className="space-y-4">
            <div>
              <Label>EasyPaisa Number</Label>
              <Input value={easypaisaNumber} onChange={(e) => setEasypaisaNumber(e.target.value)} placeholder="03001234567" />
            </div>
            <div>
              <Label>JazzCash Number</Label>
              <Input value={jazzcashNumber} onChange={(e) => setJazzcashNumber(e.target.value)} placeholder="03001234567" />
            </div>
            <div className="border-t pt-4 mt-4">
              <p className="text-sm text-muted-foreground mb-4">Bank Account (Optional)</p>
              <div className="space-y-4">
                <div>
                  <Label>Bank Name</Label>
                  <Input value={bankName} onChange={(e) => setBankName(e.target.value)} />
                </div>
                <div>
                  <Label>Account Title</Label>
                  <Input value={accountTitle} onChange={(e) => setAccountTitle(e.target.value)} />
                </div>
                <div>
                  <Label>Account Number</Label>
                  <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
                </div>
              </div>
            </div>
            <Button type="submit">Save Payment Details</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
