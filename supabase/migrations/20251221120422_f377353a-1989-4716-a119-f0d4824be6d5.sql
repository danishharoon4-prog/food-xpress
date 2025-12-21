-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'rider', 'customer');

-- Create order status enum
CREATE TYPE public.order_status AS ENUM ('pending', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'on_the_way', 'delivered', 'cancelled');

-- Create payment method enum
CREATE TYPE public.payment_method AS ENUM ('easypaisa', 'jazzcash', 'card', 'cod');

-- Create payment status enum
CREATE TYPE public.payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table (secure role management)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'customer',
  UNIQUE (user_id, role)
);

-- Create addresses table
CREATE TABLE public.addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL DEFAULT 'Home',
  address_line TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Local Town',
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create restaurants table (admin-managed)
CREATE TABLE public.restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  cuisine_type TEXT,
  address TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  is_active BOOLEAN DEFAULT true,
  opening_time TIME DEFAULT '09:00',
  closing_time TIME DEFAULT '22:00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create menu_categories table
CREATE TABLE public.menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create menu_items table
CREATE TABLE public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.menu_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  image_url TEXT,
  is_available BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create riders table
CREATE TABLE public.riders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  cnic TEXT,
  vehicle_type TEXT DEFAULT 'bike',
  vehicle_number TEXT,
  is_online BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  current_latitude DECIMAL(10, 8),
  current_longitude DECIMAL(11, 8),
  total_deliveries INT DEFAULT 0,
  average_rating DECIMAL(3, 2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create rider_wallets table
CREATE TABLE public.rider_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID REFERENCES public.riders(id) ON DELETE CASCADE NOT NULL UNIQUE,
  balance DECIMAL(10, 2) DEFAULT 0,
  total_earned DECIMAL(10, 2) DEFAULT 0,
  bonus_points INT DEFAULT 0,
  bank_name TEXT,
  account_number TEXT,
  account_title TEXT,
  easypaisa_number TEXT,
  jazzcash_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE SET NULL,
  rider_id UUID REFERENCES public.riders(id) ON DELETE SET NULL,
  status order_status DEFAULT 'pending',
  delivery_address TEXT NOT NULL,
  delivery_latitude DECIMAL(10, 8),
  delivery_longitude DECIMAL(11, 8),
  subtotal DECIMAL(10, 2) NOT NULL,
  delivery_fee DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  special_instructions TEXT,
  estimated_delivery_time TIMESTAMPTZ,
  actual_delivery_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create order_items table
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  item_price DECIMAL(10, 2) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  subtotal DECIMAL(10, 2) NOT NULL,
  special_instructions TEXT
);

-- Create payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  method payment_method NOT NULL,
  status payment_status DEFAULT 'pending',
  transaction_id TEXT,
  gateway_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create rider_earnings table
CREATE TABLE public.rider_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID REFERENCES public.riders(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  distance_km DECIMAL(5, 2),
  bonus_amount DECIMAL(10, 2) DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create rider_withdrawals table
CREATE TABLE public.rider_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID REFERENCES public.riders(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  method TEXT NOT NULL,
  account_details TEXT,
  status TEXT DEFAULT 'pending',
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create ratings table
CREATE TABLE public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  rider_id UUID REFERENCES public.riders(id) ON DELETE SET NULL,
  rider_rating INT CHECK (rider_rating >= 1 AND rider_rating <= 5),
  food_rating INT CHECK (food_rating >= 1 AND food_rating <= 5),
  review_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  is_read BOOLEAN DEFAULT false,
  data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user's primary role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- RLS Policies

-- Profiles: Users can view/update their own profile, admins can view all
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- User roles: Only admins can manage, users can view their own
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "System can insert initial role" ON public.user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Addresses: Users can manage their own addresses
CREATE POLICY "Users can manage own addresses" ON public.addresses FOR ALL USING (auth.uid() = user_id);

-- Restaurants: Public read, admin write
CREATE POLICY "Anyone can view active restaurants" ON public.restaurants FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage restaurants" ON public.restaurants FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Menu categories: Public read, admin write
CREATE POLICY "Anyone can view menu categories" ON public.menu_categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage menu categories" ON public.menu_categories FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Menu items: Public read, admin write
CREATE POLICY "Anyone can view available menu items" ON public.menu_items FOR SELECT USING (is_available = true);
CREATE POLICY "Admins can manage menu items" ON public.menu_items FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Riders: Own profile management, admin view all
CREATE POLICY "Riders can view own profile" ON public.riders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Riders can update own profile" ON public.riders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can register as rider" ON public.riders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all riders" ON public.riders FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage riders" ON public.riders FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Rider wallets: Own wallet only
CREATE POLICY "Riders can view own wallet" ON public.rider_wallets FOR SELECT USING (
  rider_id IN (SELECT id FROM public.riders WHERE user_id = auth.uid())
);
CREATE POLICY "System can manage wallets" ON public.rider_wallets FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Orders: Customer sees own, rider sees assigned, admin sees all
CREATE POLICY "Customers can view own orders" ON public.orders FOR SELECT USING (auth.uid() = customer_id);
CREATE POLICY "Customers can create orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Riders can view assigned orders" ON public.orders FOR SELECT USING (
  rider_id IN (SELECT id FROM public.riders WHERE user_id = auth.uid())
);
CREATE POLICY "Riders can update assigned orders" ON public.orders FOR UPDATE USING (
  rider_id IN (SELECT id FROM public.riders WHERE user_id = auth.uid())
);
CREATE POLICY "Admins can manage all orders" ON public.orders FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Order items: Based on order access
CREATE POLICY "Users can view order items" ON public.order_items FOR SELECT USING (
  order_id IN (SELECT id FROM public.orders WHERE customer_id = auth.uid())
);
CREATE POLICY "Users can create order items" ON public.order_items FOR INSERT WITH CHECK (
  order_id IN (SELECT id FROM public.orders WHERE customer_id = auth.uid())
);
CREATE POLICY "Admins can manage order items" ON public.order_items FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Payments: Based on order access
CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT USING (
  order_id IN (SELECT id FROM public.orders WHERE customer_id = auth.uid())
);
CREATE POLICY "Admins can manage payments" ON public.payments FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Rider earnings: Riders see own
CREATE POLICY "Riders can view own earnings" ON public.rider_earnings FOR SELECT USING (
  rider_id IN (SELECT id FROM public.riders WHERE user_id = auth.uid())
);
CREATE POLICY "Admins can manage earnings" ON public.rider_earnings FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Rider withdrawals: Riders manage own
CREATE POLICY "Riders can manage own withdrawals" ON public.rider_withdrawals FOR ALL USING (
  rider_id IN (SELECT id FROM public.riders WHERE user_id = auth.uid())
);
CREATE POLICY "Admins can manage withdrawals" ON public.rider_withdrawals FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Ratings: Customers can rate their orders
CREATE POLICY "Customers can rate own orders" ON public.ratings FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Anyone can view ratings" ON public.ratings FOR SELECT USING (true);

-- Notifications: Users see own
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT WITH CHECK (true);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'User'),
    NEW.email,
    NEW.raw_user_meta_data ->> 'phone'
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data ->> 'role')::app_role, 'customer'));
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to create wallet when rider is created
CREATE OR REPLACE FUNCTION public.handle_new_rider()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.rider_wallets (rider_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_rider_created
  AFTER INSERT ON public.riders
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_rider();

-- Function to generate order number
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.generate_order_number();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_riders_updated_at BEFORE UPDATE ON public.riders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_rider_wallets_updated_at BEFORE UPDATE ON public.rider_wallets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for orders and notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;