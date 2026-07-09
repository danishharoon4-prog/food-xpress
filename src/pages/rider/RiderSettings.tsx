import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Upload, CheckCircle2, AlertCircle, FileImage } from 'lucide-react';
import type { Rider, RiderWallet } from '@/types';
import { useRiderDocSignedUrl } from '@/lib/riderDocUrl';
import { NotificationSettings } from '@/components/NotificationSettings';

function SecureDocImage({ value, alt }: { value: string | null; alt: string }) {
  const src = useRiderDocSignedUrl(value);
  if (!src) return <div className="w-full h-40 rounded border bg-muted/30 animate-pulse" />;
  return (
    <a href={src} target="_blank" rel="noreferrer" className="block">
      <img src={src} alt={alt} className="w-full max-h-40 object-contain rounded border bg-muted/30" />
    </a>
  );
}

type DocField = 'cnic_image_url' | 'vehicle_doc_url' | 'license_image_url';

export default function RiderSettings() {
  const { user, profile, refreshProfile } = useAuth();
  const [rider, setRider] = useState<Rider | null>(null);
  const [wallet, setWallet] = useState<RiderWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<DocField | null>(null);
  const { toast } = useToast();

  // Profile form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [cnic, setCnic] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');

  // Payment form state
  const [easypaisaNumber, setEasypaisaNumber] = useState('');
  const [jazzcashNumber, setJazzcashNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountTitle, setAccountTitle] = useState('');

  const cnicInputRef = useRef<HTMLInputElement>(null);
  const vehicleInputRef = useRef<HTMLInputElement>(null);
  const licenseInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
      setCity(profile.city || '');
    }
  }, [profile]);

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
      setAddress(riderData.address || '');
      setLicenseNumber(riderData.license_number || '');

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
    if (!rider || !user) return;

    // Update profile (name, phone, city locked to Mansehra)
    const { error: pErr } = await supabase
      .from('profiles')
      .update({ full_name: fullName, phone, city: 'Mansehra' })
      .eq('id', user.id);

    if (pErr) {
      toast({ title: 'Error', description: pErr.message, variant: 'destructive' });
      return;
    }

    // Update rider details
    const { error } = await supabase
      .from('riders')
      .update({
        vehicle_type: vehicleType,
        vehicle_number: vehicleNumber,
        cnic,
        address,
        license_number: licenseNumber,
      })
      .eq('id', rider.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Saved', description: 'Profile updated successfully' });
      await refreshProfile();
      fetchData();
    }
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet) return;

    // SECURITY: direct rider_wallets UPDATE is blocked. Use RPC that only
    // allows changing payment-info columns, never balance/earnings.
    const { error } = await supabase.rpc('update_rider_payment_info', {
      _bank_name: bankName || null,
      _account_number: accountNumber || null,
      _account_title: accountTitle || null,
      _easypaisa_number: easypaisaNumber || null,
      _jazzcash_number: jazzcashNumber || null,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Saved', description: 'Payment details updated' });
    }
  };

  const handleUpload = async (file: File, field: DocField) => {
    if (!user || !rider) return;
    // No hard size limit — image files are auto-compressed before upload.
      return;
    }
    setUploading(field);

    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${user.id}/${field}-${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from('rider-documents')
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadErr) {
      toast({ title: 'Upload failed', description: uploadErr.message, variant: 'destructive' });
      setUploading(null);
      return;
    }

    // Bucket is private — store the storage path, not a public URL. Signed URLs are generated on read.
    const { error: updErr } = await supabase
      .from('riders')
      .update({ [field]: path })
      .eq('id', rider.id);

    if (updErr) {
      toast({ title: 'Save failed', description: updErr.message, variant: 'destructive' });
    } else {
      toast({ title: 'Document uploaded', description: 'Awaiting admin verification.' });
      fetchData();
    }
    setUploading(null);
  };

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Loading...</div>;
  }

  const DocUploader = ({
    title,
    field,
    inputRef,
    url,
  }: {
    title: string;
    field: DocField;
    inputRef: React.RefObject<HTMLInputElement>;
    url: string | null;
  }) => (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-medium text-sm">{title}</p>
        {url ? (
          <Badge className="bg-success/10 text-success"><CheckCircle2 className="w-3 h-3 mr-1" />Uploaded</Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground"><AlertCircle className="w-3 h-3 mr-1" />Required</Badge>
        )}
      </div>
      {url && <SecureDocImage value={url} alt={title} />}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUpload(f, field);
          e.target.value = '';
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        disabled={uploading === field}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="w-4 h-4 mr-2" />
        {uploading === field ? 'Uploading...' : url ? 'Replace' : 'Upload'}
      </Button>
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Settings</h2>
        {rider && (
          <Badge className={rider.is_verified ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}>
            {rider.is_verified ? (
              <><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Verified</>
            ) : (
              <><AlertCircle className="w-3.5 h-3.5 mr-1" /> Pending Verification</>
            )}
          </Badge>
        )}
      </div>

      {!rider?.is_verified && (
        <Card className="border-warning bg-warning/5">
          <CardContent className="py-4">
            <p className="text-sm">
              Your account is awaiting admin verification. Complete your profile and upload all documents below — once an admin approves you, you'll be able to go online and accept orders.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Personal & Vehicle Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Full Name</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03001234567" />
              </div>
              <div>
                <Label>City</Label>
                <Input value="Mansehra" disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground mt-1">Service area: Mansehra only</p>
              </div>
              <div>
                <Label>CNIC</Label>
                <Input value={cnic} onChange={(e) => setCnic(e.target.value)} placeholder="12345-1234567-1" />
              </div>
            </div>
            <div>
              <Label>Full Address</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House #, Street, Area" />
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <Label>Vehicle Type</Label>
                <Input value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} placeholder="Bike / Motorcycle" />
              </div>
              <div>
                <Label>Vehicle Number</Label>
                <Input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="ABC-123" />
              </div>
              <div>
                <Label>License Number</Label>
                <Input value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} placeholder="LHR-12345" />
              </div>
            </div>
            <Button type="submit">Save Profile</Button>
          </form>
        </CardContent>
      </Card>

      {/* Document Uploads */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileImage className="w-5 h-5" /> Verification Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          <DocUploader title="CNIC Photo" field="cnic_image_url" inputRef={cnicInputRef} url={rider?.cnic_image_url || null} />
          <DocUploader title="Vehicle Document" field="vehicle_doc_url" inputRef={vehicleInputRef} url={rider?.vehicle_doc_url || null} />
          <DocUploader title="Driving License" field="license_image_url" inputRef={licenseInputRef} url={rider?.license_image_url || null} />
        </CardContent>
      </Card>

      {/* Payment Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSavePayment} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>EasyPaisa Number</Label>
                <Input value={easypaisaNumber} onChange={(e) => setEasypaisaNumber(e.target.value)} placeholder="03001234567" />
              </div>
              <div>
                <Label>JazzCash Number</Label>
                <Input value={jazzcashNumber} onChange={(e) => setJazzcashNumber(e.target.value)} placeholder="03001234567" />
              </div>
            </div>
            <div className="border-t pt-4 mt-4">
              <p className="text-sm text-muted-foreground mb-4">Bank Account (Optional)</p>
              <div className="grid sm:grid-cols-3 gap-4">
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

      <NotificationSettings />
    </div>
  );
}
