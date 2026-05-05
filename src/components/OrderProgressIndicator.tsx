import { CheckCircle2, Clock, ChefHat, Package, Bike, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OrderStatus } from '@/types';

interface OrderProgressIndicatorProps {
  status: OrderStatus;
}

const stages = [
  { status: 'confirmed', label: 'Confirmed', icon: CheckCircle2, description: 'Order accepted' },
  { status: 'preparing', label: 'Preparing', icon: ChefHat, description: 'Chef is cooking' },
  { status: 'ready_for_pickup', label: 'Ready', icon: Package, description: 'Ready for pickup' },
  { status: 'on_the_way', label: 'On the Way', icon: Bike, description: 'Rider en route' },
  { status: 'awaiting_confirmation', label: 'Confirm Delivery', icon: CheckCircle2, description: 'Confirm you received it' },
  { status: 'delivered', label: 'Delivered & Paid', icon: Home, description: 'Enjoy your meal!' },
] as const;

const statusToStageIndex: Record<string, number> = {
  pending: -1,
  confirmed: 0,
  preparing: 1,
  ready_for_pickup: 2,
  picked_up: 3,
  on_the_way: 3,
  awaiting_confirmation: 4,
  delivered: 5,
  cancelled: -2,
};

export function OrderProgressIndicator({ status }: OrderProgressIndicatorProps) {
  const currentIndex = statusToStageIndex[status] ?? -1;
  const isCancelled = status === 'cancelled';

  if (isCancelled) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-3">
            <Clock className="w-8 h-8 text-destructive" />
          </div>
          <p className="font-semibold text-destructive">Order Cancelled</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-4">
      {/* Mobile View - Horizontal compact */}
      <div className="md:hidden">
        <div className="flex items-center justify-between gap-1">
          {stages.map((stage, index) => {
            const isCompleted = currentIndex > index;
            const isCurrent = currentIndex === index;
            const StageIcon = stage.icon;
            return (
              <div key={stage.status} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center min-w-0">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 flex-shrink-0',
                      isCompleted && 'bg-primary text-primary-foreground',
                      isCurrent && 'bg-primary text-primary-foreground ring-2 ring-primary/30 animate-pulse',
                      !isCompleted && !isCurrent && 'bg-muted text-muted-foreground'
                    )}
                  >
                    <StageIcon className="w-4 h-4" />
                  </div>
                  <p
                    className={cn(
                      'text-[10px] mt-1 text-center leading-tight truncate max-w-[52px]',
                      (isCompleted || isCurrent) ? 'text-foreground font-medium' : 'text-muted-foreground'
                    )}
                  >
                    {stage.label}
                  </p>
                </div>
                {index < stages.length - 1 && (
                  <div
                    className={cn(
                      'h-0.5 flex-1 mx-1 -mt-4 transition-colors duration-500',
                      currentIndex > index ? 'bg-primary' : 'bg-muted'
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Desktop View - Horizontal */}
      <div className="hidden md:block">
        <div className="relative flex justify-between">
          {/* Progress Line Background */}
          <div className="absolute top-5 left-0 right-0 h-1 bg-muted mx-10 rounded-full" />
          
          {/* Progress Line Filled */}
          <div
            className="absolute top-5 left-0 h-1 bg-primary mx-10 rounded-full transition-all duration-700 ease-out"
            style={{
              width: currentIndex >= 0 
                ? `calc(${(Math.min(currentIndex, stages.length - 1) / (stages.length - 1)) * 100}% - 5rem)` 
                : '0%'
            }}
          />

          {stages.map((stage, index) => {
            const isCompleted = currentIndex > index;
            const isCurrent = currentIndex === index;
            const isPending = currentIndex < index;
            const StageIcon = stage.icon;

            return (
              <div key={stage.status} className="flex flex-col items-center text-center z-10 flex-1">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center mb-3 transition-all duration-500 bg-background',
                    isCompleted && 'bg-primary text-primary-foreground shadow-lg shadow-primary/30',
                    isCurrent && 'bg-primary text-primary-foreground ring-4 ring-primary/20 shadow-lg shadow-primary/30',
                    isPending && 'bg-muted text-muted-foreground border-2 border-muted'
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <StageIcon className={cn('w-5 h-5', isCurrent && 'animate-pulse')} />
                  )}
                </div>
                <p
                  className={cn(
                    'text-sm font-medium transition-colors',
                    (isCompleted || isCurrent) ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {stage.label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-[100px]">
                  {stage.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
