import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import CustomerHeader from '@/components/CustomerHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { LocationPicker } from '@/components/LocationPicker';
import { User, MapPin, Phone, Mail, Building, Heart, Loader2, Save, Trash2, Camera, X, CheckCircle2, Pencil } from 'lucide-react';
import { NotificationSettings } from '@/components/NotificationSettings';
import { MotionSettings } from '@/components/MotionSettings';
import { NavigationSettings } from '@/components/NavigationSettings';
import AvatarUploader from '@/components/AvatarUploader';


interface FavoriteRestaurant {
  id: string;
  restaurant_id: string;
  restaurant: { id: string; name: string; cuisine_type: string | null; image_url: string | null };
}

export default function UserProfile() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [permanentAddress, setPermanentAddress] = useState('');
  const [permanentCoords, setPermanentCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [initialCoords, setInitialCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [favorites, setFavorites] = useState<FavoriteRestaurant[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(true);
  const [editingAddress, setEditingAddress] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/auth?redirect=/profile');
      return;
    }
    fetchProfileData();
    fetchFavorites();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchProfileData = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (data) {
      setFullName(data.full_name || '');
      setEmail(data.email || '');
      setPhone(data.phone || '');
      setCity((data as any).city || '');
      setAvatarUrl((data as any).avatar_url || null);
      setPermanentAddress((data as any).permanent_address || '');
      if ((data as any).permanent_latitude && (data as any).permanent_longitude) {
        const c = {
          latitude: Number((data as any).permanent_latitude),
          longitude: Number((data as any).permanent_longitude),
        };
        setPermanentCoords(c);
        setInitialCoords(c);
      }
    }
  };

  const fetchFavorites = async () => {
    if (!user) return;
    setLoadingFavorites(true);
    const { data } = await supabase
      .from('favorite_restaurants')
      .select('id, restaurant_id, restaurants:restaurant_id(id, name, cuisine_type, image_url)')
      .eq('user_id', user.id);

    if (data) {
      setFavorites(
        data.map((d: any) => ({
          id: d.id,
          restaurant_id: d.restaurant_id,
          restaurant: d.restaurants,
        }))
      );
    }
    setLoadingFavorites(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          phone: phone || null,
          city: 'Mansehra',
          permanent_address: permanentAddress || null,
          permanent_latitude: permanentCoords?.latitude || null,
          permanent_longitude: permanentCoords?.longitude || null,
        } as any)
        .eq('id', user.id);

      if (error) throw error;
      if (permanentCoords) setInitialCoords(permanentCoords);
      setEditingAddress(false);
      await refreshProfile();
      toast({ title: 'Profile Updated', description: 'Your profile has been saved successfully.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handlePermanentAddressChange = (address: string, coords?: { latitude: number; longitude: number }) => {
    setPermanentAddress(address);
    if (coords) {
      setPermanentCoords(coords);
    }
  };

  const handleRemoveFavorite = async (favoriteId: string) => {
    const { error } = await supabase.from('favorite_restaurants').delete().eq('id', favoriteId);
    if (error) {
      toast({ title: 'Error', description: 'Failed to remove favorite', variant: 'destructive' });
    } else {
      setFavorites((prev) => prev.filter((f) => f.id !== favoriteId));
      toast({ title: 'Removed', description: 'Restaurant removed from favorites.' });
    }
  };



  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please choose an image.', variant: 'destructive' });
      return;
    }
    setUploadingAvatar(true);
    try {
      // Auto-compress + center-crop to a square avatar. No size limit for the user.
      const { compressImage } = await import('@/lib/compressImage');
      const blob = await compressImage(file, { maxSize: 512, quality: 0.85, square: true });
      const path = `${user.id}/avatar-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, cacheControl: '3600', contentType: 'image/jpeg' });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = pub.publicUrl;
      const { error: dbErr } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl } as any)
        .eq('id', user.id);
      if (dbErr) throw dbErr;
      setAvatarUrl(publicUrl);
      await refreshProfile();
      toast({ title: 'Profile picture updated' });
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;
    setUploadingAvatar(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null } as any)
        .eq('id', user.id);
      if (error) throw error;
      setAvatarUrl(null);
      await refreshProfile();
      toast({ title: 'Profile picture removed' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const initials = (fullName || email || 'U')
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background pb-8">
      <CustomerHeader />
      <main className="container py-8 max-w-2xl">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <User className="w-6 h-6 text-primary" />
          My Profile
        </h1>

        <div className="space-y-6">
          {/* Avatar */}
          <Card>
            <CardContent className="pt-6">
              <AvatarUploader
                userId={user!.id}
                fullName={fullName}
                email={email}
                onChanged={() => refreshProfile()}
              />
            </CardContent>
          </Card>

          {/* Personal Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5" /> Full Name
                </Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" /> Email
                </Label>
                <Input id="email" value={email} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" /> Mobile Number
                </Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+92 300 1234567" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city" className="flex items-center gap-1">
                  <Building className="w-3.5 h-3.5" /> City
                </Label>
                <Input id="city" value="Mansehra" disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">Service currently available in Mansehra only</p>
              </div>
            </CardContent>
          </Card>

          {/* Permanent Address */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary" />
                    Permanent Address
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Set once — used as your default delivery address. You can still change it at checkout.
                  </p>
                </div>
                {permanentAddress && initialCoords && !editingAddress && (
                  <Button size="sm" variant="outline" onClick={() => setEditingAddress(true)}>
                    <Pencil className="w-3.5 h-3.5 mr-1.5" /> Change
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {permanentAddress && initialCoords && !editingAddress ? (
                <div className="rounded-lg border bg-success/5 border-success/30 p-4 flex items-start gap-3">
                  <div className="p-2 rounded-full bg-success/10 shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Address confirmed</p>
                    <p className="text-sm text-muted-foreground mt-0.5 break-words">{permanentAddress}</p>
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      📍 {initialCoords.latitude.toFixed(6)}, {initialCoords.longitude.toFixed(6)}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <LocationPicker
                    value={permanentAddress}
                    onChange={handlePermanentAddressChange}
                    placeholder="Enter your permanent/home address..."
                    initialCoords={initialCoords}
                  />
                  {permanentCoords && (
                    <p className="text-xs text-muted-foreground mt-2">
                      📍 GPS: {permanentCoords.latitude.toFixed(6)}, {permanentCoords.longitude.toFixed(6)}
                    </p>
                  )}
                  {initialCoords && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-2"
                      onClick={() => setEditingAddress(false)}
                    >
                      Cancel
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Save Button */}
          <Button onClick={handleSave} disabled={loading} className="w-full gradient-primary h-12 text-lg">
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5 mr-2" /> Save Profile
              </>
            )}
          </Button>

          <Separator />

          {/* Favorite Restaurants */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Heart className="w-5 h-5 text-destructive" />
                Favourite Restaurants
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingFavorites ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : favorites.length === 0 ? (
                <p className="text-muted-foreground text-center py-6">
                  No favourite restaurants yet. Browse restaurants to add some!
                </p>
              ) : (
                <div className="space-y-3">
                  {favorites.map((fav) => (
                    <div key={fav.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-3">
                        {fav.restaurant.image_url ? (
                          <img src={fav.restaurant.image_url} alt={fav.restaurant.name} className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-xs">🍽️</div>
                        )}
                        <div>
                          <p className="font-medium">{fav.restaurant.name}</p>
                          {fav.restaurant.cuisine_type && (
                            <p className="text-xs text-muted-foreground">{fav.restaurant.cuisine_type}</p>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveFavorite(fav.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Security & 2FA</p>
                <p className="text-sm text-muted-foreground">Two-factor auth, sign-in history, auto sign-out.</p>
              </div>
              <Link to="/settings/security" className="text-sm font-medium text-primary hover:underline whitespace-nowrap">
                Manage →
              </Link>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <NotificationSettings />

          {/* Motion & animation controls */}
          <MotionSettings />

          {/* Swipe navigation controls */}
          <NavigationSettings />
        </div>


      </main>
    </div>
  );
}
