import { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function PaymentCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const status = params.get('status');
  const orderId = params.get('order');
  const message = params.get('message');

  const isSuccess = status === 'success';

  const targetPath = useMemo(
    () => (orderId ? `/order/${orderId}` : '/orders'),
    [orderId],
  );

  useEffect(() => {
    if (isSuccess) {
      const t = setTimeout(() => navigate(targetPath, { replace: true }), 2500);
      return () => clearTimeout(t);
    }
  }, [isSuccess, targetPath, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-4">
          {isSuccess ? (
            <>
              <CheckCircle2 className="w-16 h-16 text-primary mx-auto" />
              <h1 className="text-2xl font-bold">Payment Successful</h1>
              <p className="text-sm text-muted-foreground">
                Your order has been confirmed. Redirecting to order tracking…
              </p>
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
              <Button onClick={() => navigate(targetPath, { replace: true })} className="w-full">
                Go to Order
              </Button>
            </>
          ) : (
            <>
              <XCircle className="w-16 h-16 text-destructive mx-auto" />
              <h1 className="text-2xl font-bold">Payment Failed</h1>
              <p className="text-sm text-muted-foreground">
                {message || 'Your payment could not be completed.'}
              </p>
              <div className="grid gap-2">
                <Button onClick={() => navigate(targetPath, { replace: true })}>
                  View Order
                </Button>
                <Button variant="outline" onClick={() => navigate('/restaurants')}>
                  Back to Restaurants
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
