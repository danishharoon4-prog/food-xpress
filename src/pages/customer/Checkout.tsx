import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import CustomerHeader from '@/components/CustomerHeader';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { LocationPicker } from '@/components/LocationPicker';
import { DistanceDisplay } from '@/components/DistanceDisplay';
import { useLocation } from '@/hooks/useLocation';
import { MapPin, CreditCard, Wallet, Banknote, Loader2, Truck, Clock } from 'lucide-react';
import { JazzCashPaymentDialog } from '@/components/JazzCashPaymentDialog';
import type { PaymentMethod } from '@/types';

const ALL_PAYMENT_METHODS = [
  { value: 'cod', label: 'Cash on Delivery', icon: Banknote, description: 'Pay when you receive', flag: 'cod_enabled' as const },
  { value: 'easypaisa', label: 'EasyPaisa', icon: Wallet, description: 'Pay via EasyPaisa', flag: 'easypaisa_enabled' as const },
  { value: 'jazzcash', label: 'JazzCash', icon: Wallet, description: 'Pay via JazzCash wallet', flag: 'jazzcash_enabled' as const },
  { value: 'card', label: 'Credit/Debit Card', icon: CreditCard, description: 'Secure card payment via JazzCash', flag: 'stripe_enabled' as const },
] as const;

export default function Checkout() {
  const { user } = useAuth();
  const { items, getSubtotal, getRestaurantId, clearCart } = useCart();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryCoords, setDeliveryCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [restaurantCoords, setRestaurantCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [deliveryFee, setDeliveryFee] = useState(150);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [estimatedTime, setEstimatedTime] = useState<string | null>(null);
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | null>(null);
  const [calculatingFee, setCalculatingFee] = useState(false);
  const [hasSavedAddress, setHasSavedAddress] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [jcOpen, setJcOpen] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<{ id: string; number: string; total: number } | null>(null);
  const [enabledMethods, setEnabledMethods] = useState<typeof ALL_PAYMENT_METHODS[number][]>(
    ALL_PAYMENT_METHODS.filter((m) => m.value === 'cod'),
  );

  const subtotal = getSubtotal();
  const total = subtotal + deliveryFee;
  const restaurantId = getRestaurantId();

  const { calculateDistance, detectLocation } = useLocation();

  // Load permanent address from profile first, then auto-detect GPS if none
  useEffect(() => {
    const loadAddress = async () => {
      if (!user) return;
      // Check for saved permanent address
      const { data: profileData } = await supabase
        .from('profiles')
        .select('permanent_address, permanent_latitude, permanent_longitude')
        .eq('id', user.id)
        .maybeSingle();

      const p = profileData as any;
      if (p?.permanent_address) {
        setDeliveryAddress(p.permanent_address);
        if (p.permanent_latitude && p.permanent_longitude) {
          setDeliveryCoords({ latitude: Number(p.permanent_latitude), longitude: Number(p.permanent_longitude) });
        }
        setHasSavedAddress(true);
        return; // Use saved address, don't ask again
      }

      // No saved address — auto-detect GPS as a starting point
      try {
        const data = await detectLocation();
        setDeliveryAddress(data.address);
        setDeliveryCoords({ latitude: data.latitude, longitude: data.longitude });
      } catch (error) {
        console.log('Auto GPS detection skipped:', error);
      }
    };
    loadAddress();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load which payment methods admin has enabled
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('platform_settings')
        .select('cod_enabled, easypaisa_enabled, jazzcash_enabled, stripe_enabled')
        .eq('singleton', true)
        .maybeSingle();

      const flags = (data ?? {
        cod_enabled: true,
        easypaisa_enabled: false,
        jazzcash_enabled: true,
        stripe_enabled: true,
      }) as Record<string, boolean>;

      const available = ALL_PAYMENT_METHODS.filter((m) => flags[m.flag] !== false);
      setEnabledMethods(available.length ? available : [ALL_PAYMENT_METHODS[0]]);
      // If current selection got disabled, fall back to first available
      if (!available.some((m) => m.value === paymentMethod)) {
        setPaymentMethod((available[0]?.value ?? 'cod') as PaymentMethod);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Don't bounce to /cart if a JazzCash dialog is open — cart was cleared after order placement
    if (items.length === 0 && !jcOpen && !pendingOrder) {
      navigate('/cart');
    }
    if (!user) {
      navigate('/auth?redirect=/checkout');
    }
  }, [items, user, navigate, jcOpen, pendingOrder]);

  // Fetch restaurant coordinates
  useEffect(() => {
    const fetchRestaurantCoords = async () => {
      if (!restaurantId) return;
      
      const { data } = await supabase
        .from('restaurants')
        .select('latitude, longitude')
        .eq('id', restaurantId)
        .single();
      
      if (data?.latitude && data?.longitude) {
        setRestaurantCoords({ lat: data.latitude, lng: data.longitude });
      }
    };
    
    fetchRestaurantCoords();
  }, [restaurantId]);

  // Calculate delivery fee based on distance
  
  const calculateDeliveryFee = (distanceInKm: number): number => {
    const baseDistance = 4; // 4 KM
    const baseFee = 150; // PKR 150 for first 4 KM
    const additionalFeePerKm = 25; // PKR 25 per additional KM

    if (distanceInKm <= baseDistance) {
      return baseFee;
    }

    const additionalKm = Math.ceil(distanceInKm - baseDistance);
    return baseFee + (additionalKm * additionalFeePerKm);
  };

  useEffect(() => {
    const fetchDeliveryFee = async () => {
      if (!restaurantCoords || !deliveryCoords) {
        setDeliveryFee(150); // Default fee
        setDistanceKm(null);
        setEstimatedTime(null);
        return;
      }

      setCalculatingFee(true);
      try {
        const result = await calculateDistance(
          restaurantCoords,
          { lat: deliveryCoords.latitude, lng: deliveryCoords.longitude }
        );
        
        // distance.value is in meters, convert to km
        const distanceKm = result.distance.value / 1000;
        setDistanceKm(distanceKm);
        setDeliveryFee(calculateDeliveryFee(distanceKm));
        
        // Add prep time (15 min) to travel time for total estimated delivery
        const travelMinutes = Math.ceil(result.duration.value / 60);
        const prepTime = 15; // Restaurant preparation time
        const totalMinutes = travelMinutes + prepTime;
        setEstimatedTime(`${totalMinutes}-${totalMinutes + 10} mins`);
        setEstimatedMinutes(totalMinutes);
      } catch (error) {
        console.error('Error calculating distance:', error);
        setDeliveryFee(150); // Fallback to base fee
        setEstimatedTime(null);
        setEstimatedMinutes(null);
      } finally {
        setCalculatingFee(false);
      }
    };

    fetchDeliveryFee();
  }, [restaurantCoords, deliveryCoords, calculateDistance]);

  const handleAddressChange = (address: string, coords?: { latitude: number; longitude: number }) => {
    setDeliveryAddress(address);
    if (coords) {
      setDeliveryCoords(coords);
    }
  };

  const handlePlaceOrder = async () => {
    if (!deliveryAddress.trim()) {
      toast({ title: 'Error', description: 'Please enter a delivery address', variant: 'destructive' });
      return;
    }

    if (!user) {
      navigate('/auth?redirect=/checkout');
      return;
    }

    if (!restaurantId) {
      toast({ title: 'Cart is empty', description: 'Add items before checking out.', variant: 'destructive' });
      return;
    }

    setLoading(true);

    try {
      // Validate the restaurant still exists (guards against stale cart from a deleted restaurant)
      const { data: restaurantRow, error: restaurantErr } = await supabase
        .from('restaurants')
        .select('id, is_active')
        .eq('id', restaurantId)
        .maybeSingle();

      if (restaurantErr) throw restaurantErr;

      if (!restaurantRow) {
        clearCart();
        toast({
          title: 'Restaurant no longer available',
          description: 'This restaurant has been removed. Your cart was cleared — please pick another restaurant.',
          variant: 'destructive',
        });
        setLoading(false);
        navigate('/restaurants');
        return;
      }

      if (restaurantRow.is_active === false) {
        toast({
          title: 'Restaurant unavailable',
          description: 'This restaurant is currently not accepting orders.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // SECURITY: use place_order RPC — server recomputes prices and delivery fee
      const { data: rpcData, error: rpcError } = await supabase.rpc('place_order', {
        _restaurant_id: restaurantId,
        _delivery_address: deliveryAddress,
        _delivery_latitude: deliveryCoords?.latitude ?? null,
        _delivery_longitude: deliveryCoords?.longitude ?? null,
        _special_instructions: specialInstructions || null,
        _payment_method: paymentMethod,
        _items: items.map((item) => ({
          menu_item_id: item.menuItem.id,
          quantity: item.quantity,
          size: item.selectedSize?.name || null,
          special_instructions: item.specialInstructions || null,
        })),
        _estimated_minutes: estimatedMinutes ?? 45,
      });

      if (rpcError) {
        if (/foreign key/i.test(rpcError.message) || /Restaurant not/i.test(rpcError.message)) {
          clearCart();
          toast({
            title: 'Restaurant no longer available',
            description: 'Your cart was cleared. Please pick another restaurant.',
            variant: 'destructive',
          });
          setLoading(false);
          navigate('/restaurants');
          return;
        }
        throw rpcError;
      }

      const placed = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      if (!placed?.order_id) throw new Error('Order could not be created');

      clearCart();

      if (paymentMethod === 'jazzcash') {
        setPendingOrder({ id: placed.order_id, number: placed.order_number, total });
        setJcOpen(true);
        toast({ title: 'Order Created', description: `Complete payment to confirm order #${placed.order_number}.` });
      } else if (paymentMethod === 'card') {
        // JazzCash Hosted Checkout (MIGS) — redirect to JazzCash card page
        toast({ title: 'Redirecting to Payment', description: 'Taking you to JazzCash secure card page…' });
        const { data: hc, error: hcErr } = await supabase.functions.invoke('jazzcash-hosted-checkout', {
          body: { order_id: placed.order_id, return_origin: window.location.origin },
        });
        if (hcErr || !hc?.endpoint || !hc?.fields) {
          toast({
            title: 'Payment redirect failed',
            description: hcErr?.message || 'Could not open card payment page. Your order is saved — try paying again from My Orders.',
            variant: 'destructive',
          });
          navigate(`/order/${placed.order_id}`);
          return;
        }
        // Build & auto-submit a form to JazzCash
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = hc.endpoint as string;
        form.style.display = 'none';
        Object.entries(hc.fields as Record<string, string>).forEach(([k, v]) => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = k;
          input.value = v ?? '';
          form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();
      } else if (paymentMethod === 'easypaisa') {
        toast({
          title: 'EasyPaisa not available',
          description: 'EasyPaisa payments are not enabled yet. Your order is saved — please pay with JazzCash, Card, or Cash on Delivery.',
          variant: 'destructive',
        });
        navigate(`/order/${placed.order_id}`);
      } else {
        toast({ title: 'Order Placed!', description: `Order #${placed.order_number} has been placed successfully.` });
        navigate(`/order/${placed.order_id}`);
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <CustomerHeader />

      <main className="container py-8">
        <h1 className="text-2xl font-bold mb-6">Checkout</h1>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Delivery Address */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  Delivery Address
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {hasSavedAddress && !editingAddress ? (
                  <div className="rounded-lg border bg-accent/40 p-4 space-y-2">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                          Delivering to your saved address
                        </p>
                        <p className="text-sm font-medium mt-1">{deliveryAddress}</p>
                        {deliveryCoords && (
                          <p className="text-xs text-muted-foreground mt-1">
                            📍 {deliveryCoords.latitude.toFixed(5)}, {deliveryCoords.longitude.toFixed(5)}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingAddress(true)}
                      className="w-full"
                    >
                      Change address for this order
                    </Button>
                  </div>
                ) : (
                  <LocationPicker
                    value={deliveryAddress}
                    onChange={handleAddressChange}
                    placeholder="Enter your complete delivery address..."
                  />
                )}

                {/* Distance from restaurant */}
                {deliveryCoords && (
                  <DistanceDisplay
                    restaurantCoords={restaurantCoords}
                    customerCoords={deliveryCoords ? { lat: deliveryCoords.latitude, lng: deliveryCoords.longitude } : null}
                  />
                )}
              </CardContent>
            </Card>

            {/* Special Instructions */}
            <Card>
              <CardHeader>
                <CardTitle>Special Instructions (Optional)</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Any special requests for your order..."
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  rows={2}
                />
              </CardContent>
            </Card>

            {/* Payment Method */}
            <Card>
              <CardHeader>
                <CardTitle>Payment Method</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {enabledMethods.map((method) => (
                      <Label
                        key={method.value}
                        htmlFor={method.value}
                        className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                          paymentMethod === method.value
                            ? 'border-primary bg-accent'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <RadioGroupItem value={method.value} id={method.value} />
                        <method.icon className="w-5 h-5 text-primary" />
                        <div>
                          <p className="font-medium">{method.label}</p>
                          <p className="text-xs text-muted-foreground">{method.description}</p>
                        </div>
                      </Label>
                    ))}
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div>
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.map((item) => {
                  const unit = item.selectedSize ? Number(item.selectedSize.price) : Number(item.menuItem.price);
                  return (
                  <div key={item.cartKey} className="flex justify-between text-sm">
                    <span>
                      {item.menuItem.name}
                      {item.selectedSize ? ` (${item.selectedSize.name})` : ''} × {item.quantity}
                    </span>
                    <span>PKR {(unit * item.quantity).toLocaleString()}</span>
                  </div>
                  );
                })}

                <Separator />

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>PKR {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Truck className="w-3 h-3" />
                    Delivery Fee
                    {distanceKm !== null && (
                      <span className="text-xs">({distanceKm.toFixed(1)} km)</span>
                    )}
                  </span>
                  {calculatingFee ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>PKR {deliveryFee.toLocaleString()}</span>
                  )}
                </div>
                
                {estimatedTime && (
                  <div className="flex justify-between text-sm items-center bg-accent/50 p-2 rounded-md">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Est. Delivery Time
                    </span>
                    <span className="font-medium text-primary">{estimatedTime}</span>
                  </div>
                )}

                <Separator />

                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span className="text-primary">PKR {total.toLocaleString()}</span>
                </div>

                <Button
                  className="w-full gradient-primary h-12 text-lg"
                  onClick={handlePlaceOrder}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Placing Order...
                    </>
                  ) : (
                    `Place Order • PKR ${total.toLocaleString()}`
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  By placing this order, you agree to our terms and conditions
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {pendingOrder && (
        <JazzCashPaymentDialog
          open={jcOpen}
          onOpenChange={(v) => {
            setJcOpen(v);
            if (!v && pendingOrder) {
              // If user closes without paying, still take them to order tracking
              navigate(`/order/${pendingOrder.id}`);
              setPendingOrder(null);
            }
          }}
          orderId={pendingOrder.id}
          orderNumber={pendingOrder.number}
          amount={pendingOrder.total}
          purpose="order"
          onSuccess={() => {
            navigate(`/order/${pendingOrder.id}`);
            setPendingOrder(null);
          }}
        />
      )}
    </div>
  );
}
