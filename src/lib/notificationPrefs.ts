// Maps notification event names (order status or system) to
// notification_preferences boolean columns.
export const STATUS_TO_PREF: Record<string, string> = {
  order_placed: 'event_order_placed',
  pending: 'event_order_placed',
  confirmed: 'event_confirmed',
  preparing: 'event_preparing',
  ready_for_pickup: 'event_ready_for_pickup',
  picked_up: 'event_picked_up',
  on_the_way: 'event_on_the_way',
  awaiting_confirmation: 'event_awaiting_confirmation',
  delivered: 'event_delivered',
  cancelled: 'event_cancelled',
};

export const EVENT_LABELS: { key: keyof NotifPrefs; label: string }[] = [
  { key: 'event_order_placed', label: 'Order placed' },
  { key: 'event_confirmed', label: 'Order confirmed' },
  { key: 'event_preparing', label: 'Preparing' },
  { key: 'event_ready_for_pickup', label: 'Ready for pickup' },
  { key: 'event_picked_up', label: 'Picked up' },
  { key: 'event_on_the_way', label: 'On the way' },
  { key: 'event_awaiting_confirmation', label: 'Awaiting confirmation' },
  { key: 'event_delivered', label: 'Delivered' },
  { key: 'event_cancelled', label: 'Cancelled' },
];

export type NotifPrefs = {
  user_id: string;
  push_enabled: boolean;
  toast_enabled: boolean;
  sound_enabled: boolean;
  event_order_placed: boolean;
  event_confirmed: boolean;
  event_preparing: boolean;
  event_ready_for_pickup: boolean;
  event_picked_up: boolean;
  event_on_the_way: boolean;
  event_awaiting_confirmation: boolean;
  event_delivered: boolean;
  event_cancelled: boolean;
};

export const DEFAULT_PREFS: Omit<NotifPrefs, 'user_id'> = {
  push_enabled: true,
  toast_enabled: false,
  sound_enabled: true,
  event_order_placed: true,
  event_confirmed: true,
  event_preparing: true,
  event_ready_for_pickup: true,
  event_picked_up: true,
  event_on_the_way: true,
  event_awaiting_confirmation: true,
  event_delivered: true,
  event_cancelled: true,
};
