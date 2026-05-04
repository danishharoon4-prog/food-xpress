export type AppRole = 'admin' | 'rider' | 'customer' | 'restaurant';

export type OrderStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'preparing' 
  | 'ready_for_pickup' 
  | 'picked_up' 
  | 'on_the_way' 
  | 'awaiting_confirmation'
  | 'delivered' 
  | 'cancelled';

export type PaymentMethod = 'easypaisa' | 'jazzcash' | 'card' | 'cod';

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  city: string | null;
  permanent_address: string | null;
  permanent_latitude: number | null;
  permanent_longitude: number | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export interface Address {
  id: string;
  user_id: string;
  label: string;
  address_line: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
  created_at: string;
}

export interface Restaurant {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  cuisine_type: string | null;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  opening_time: string;
  closing_time: string;
  created_at: string;
  updated_at: string;
}

export interface MenuCategory {
  id: string;
  restaurant_id: string;
  name: string;
  display_order: number;
  created_at: string;
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
  category?: MenuCategory;
  restaurant?: Restaurant;
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  specialInstructions?: string;
}

export interface Rider {
  id: string;
  user_id: string;
  cnic: string | null;
  vehicle_type: string;
  vehicle_number: string | null;
  address: string | null;
  license_number: string | null;
  cnic_image_url: string | null;
  vehicle_doc_url: string | null;
  license_image_url: string | null;
  is_online: boolean;
  is_verified: boolean;
  current_latitude: number | null;
  current_longitude: number | null;
  total_deliveries: number;
  average_rating: number;
  created_at: string;
  updated_at: string;
  profile?: Profile;
}

export interface RiderWallet {
  id: string;
  rider_id: string;
  balance: number;
  total_earned: number;
  bonus_points: number;
  bank_name: string | null;
  account_number: string | null;
  account_title: string | null;
  easypaisa_number: string | null;
  jazzcash_number: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  restaurant_id: string | null;
  rider_id: string | null;
  status: OrderStatus;
  delivery_address: string;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  special_instructions: string | null;
  estimated_delivery_time: string | null;
  actual_delivery_time: string | null;
  created_at: string;
  updated_at: string;
  restaurant?: Restaurant;
  rider?: Rider;
  order_items?: OrderItem[];
  payment?: Payment;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  item_name: string;
  item_price: number;
  quantity: number;
  subtotal: number;
  special_instructions: string | null;
}

export interface Payment {
  id: string;
  order_id: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  transaction_id: string | null;
  gateway_response: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface RiderEarning {
  id: string;
  rider_id: string;
  order_id: string | null;
  amount: number;
  distance_km: number | null;
  bonus_amount: number;
  description: string | null;
  created_at: string;
}

export interface Rating {
  id: string;
  order_id: string;
  customer_id: string;
  rider_id: string | null;
  rider_rating: number | null;
  food_rating: number | null;
  review_text: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  data: Record<string, unknown> | null;
  created_at: string;
}
