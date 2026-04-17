import { useEffect, useState } from 'react';
import { Clock, CheckCircle2 } from 'lucide-react';

interface DeliveryCountdownProps {
  estimatedDeliveryTime: string | null;
  status: string;
  className?: string;
}

/**
 * Live countdown to estimated delivery time.
 * Shows "Arriving soon" when overdue, hides when delivered/cancelled.
 */
export function DeliveryCountdown({ estimatedDeliveryTime, status, className = '' }: DeliveryCountdownProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!estimatedDeliveryTime) return null;
  if (status === 'delivered') {
    return (
      <div className={`flex items-center gap-2 text-sm text-success ${className}`}>
        <CheckCircle2 className="w-4 h-4" />
        <span className="font-medium">Delivered</span>
      </div>
    );
  }
  if (status === 'cancelled') return null;

  const target = new Date(estimatedDeliveryTime).getTime();
  const diffMs = target - now;
  const isOverdue = diffMs <= 0;

  const absSec = Math.floor(Math.abs(diffMs) / 1000);
  const mins = Math.floor(absSec / 60);
  const secs = absSec % 60;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Clock className={`w-4 h-4 ${isOverdue ? 'text-warning' : 'text-primary'}`} />
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">
          {isOverdue ? 'Arriving soon' : 'Estimated arrival in'}
        </span>
        <span className={`font-bold tabular-nums ${isOverdue ? 'text-warning' : 'text-primary'}`}>
          {isOverdue ? `+${mins}:${secs.toString().padStart(2, '0')}` : `${mins}:${secs.toString().padStart(2, '0')}`}
        </span>
      </div>
    </div>
  );
}
