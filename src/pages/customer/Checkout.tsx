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
import type { PaymentMethod } from '@/types';

const paymentMethods = [
  { value: 'cod', label: 'Cash on Delivery', icon: Banknote, description: 'Pay when you receive' },
  { value: 'easypaisa', label: 'EasyPaisa', icon: Wallet, description: 'Pay via EasyPaisa' },
  { value: 'jazzcash', label: 'JazzCash', icon: Wallet, description: 'Pay via JazzCash' },
  { value: 'card', label: 'Credit/Debit Card', icon: CreditCard, description: 'Secure card payment' },
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
  const [deliveryFee, setDeliveryFee] = useState(100);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [estimatedTime, setEstimatedTime] = useState<string | null>(null);
  const [calculatingFee, setCalculatingFee] = useState(false);

  const subtotal = getSubtotal();
  const total = subtotal + deliveryFee;
  const restaurantId = getRestaurantId();

  const { calculateDistance, detectLocation } = useLocation();

  // Auto-detect GPS location on mount
  useEffect(() => {
    const autoDetect = async () => {
      try {
        const data = await detectLocation();
        setDeliveryAddress(data.address);
        setDeliveryCoords({ latitude: data.latitude, longitude: data.longitude });
      } catch (error) {
        // User may deny permission, that's ok
        console.log('Auto GPS detection skipped:', error);
      }
    };
    autoDetect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (items.length === 0) {
      navigate('/cart');
    }
    if (!user) {
      navigate('/auth?redirect=/checkout');
    }
  }, [items, user, navigate]);

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
  const { calculateDistance } = useLocation();
  
  const calculateDeliveryFee = (distanceInKm: number): number => {
    const baseDistance = 4; // 4 KM
    const baseFee = 100; // RS 100 for first 4 KM
    const additionalFeePerKm = 50; // RS 50 per additional KM
    
    if (distanceInKm <= baseDistance) {
      return baseFee;
    }
    
    const additionalKm = Math.ceil(distanceInKm - baseDistance);
    return baseFee + (additionalKm * additionalFeePerKm);
  };

  useEffect(() => {
    const fetchDeliveryFee = async () => {
      if (!restaurantCoords || !deliveryCoords) {
        setDeliveryFee(100); // Default fee
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
      } catch (error) {
        console.error('Error calculating distance:', error);
        setDeliveryFee(100); // Fallback to base fee
        setEstimatedTime(null);
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

    setLoading(true);

    try {
      // Create order - order_number is auto-generated by database trigger
      const orderData = {
        customer_id: user.id,
        restaurant_id: restaurantId,
        delivery_address: deliveryAddress,
        delivery_latitude: deliveryCoords?.latitude || null,
        delivery_longitude: deliveryCoords?.longitude || null,
        subtotal,
        delivery_fee: deliveryFee,
        total,
        special_instructions: specialInstructions || null,
        order_number: '', // Placeholder - will be auto-generated by trigger
      };

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = items.map((item) => ({
        order_id: order.id,
        menu_item_id: item.menuItem.id,
        item_name: item.menuItem.name,
        item_price: item.menuItem.price,
        quantity: item.quantity,
        subtotal: Number(item.menuItem.price) * item.quantity,
        special_instructions: item.specialInstructions || null,
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;

      // Create payment record
      const { error: paymentError } = await supabase.from('payments').insert({
        order_id: order.id,
        amount: total,
        method: paymentMethod,
        status: paymentMethod === 'cod' ? 'pending' : 'pending',
      });
      if (paymentError) throw paymentError;

      // Clear cart and redirect
      clearCart();
      toast({ title: 'Order Placed!', description: `Order #${order.order_number} has been placed successfully.` });
      navigate(`/order/${order.id}`);
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
                <LocationPicker
                  value={deliveryAddress}
                  onChange={handleAddressChange}
                  placeholder="Enter your complete delivery address..."
                />
                
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
                    {paymentMethods.map((method) => (
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
                {items.map((item) => (
                  <div key={item.menuItem.id} className="flex justify-between text-sm">
                    <span>
                      {item.menuItem.name} × {item.quantity}
                    </span>
                    <span>PKR {(Number(item.menuItem.price) * item.quantity).toLocaleString()}</span>
                  </div>
                ))}

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
    </div>
  );
}
