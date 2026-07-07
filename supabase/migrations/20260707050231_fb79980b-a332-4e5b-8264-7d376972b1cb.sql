
-- 1) Signup: hardcode customer role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, city)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'User'),
    NEW.email,
    NEW.raw_user_meta_data ->> 'phone',
    'Mansehra'
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer'::app_role);
  RETURN NEW;
END;
$$;

-- 2) create_system_notification admin-only
CREATE OR REPLACE FUNCTION public.create_system_notification(
  p_user_id uuid, p_title text, p_message text,
  p_type text DEFAULT 'info', p_data jsonb DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE notification_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can create system notifications';
  END IF;
  INSERT INTO public.notifications (user_id, title, message, type, data)
  VALUES (p_user_id, p_title, p_message, p_type, p_data)
  RETURNING id INTO notification_id;
  RETURN notification_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_system_notification(uuid,text,text,text,jsonb) FROM anon;

-- 3) Remove broad customer UPDATE on orders
DROP POLICY IF EXISTS "Customers can update own orders" ON public.orders;

-- 4) Remove overly broad ratings SELECT policy
DROP POLICY IF EXISTS "Anyone can view ratings" ON public.ratings;

-- Aggregate helper for public restaurant list (no PII)
CREATE OR REPLACE FUNCTION public.get_restaurant_rating_summary(_restaurant_id uuid)
RETURNS TABLE(avg_rating numeric, rating_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    COALESCE(AVG(NULLIF(
      (COALESCE(restaurant_rating,0) + COALESCE(food_rating,0))::numeric
      / NULLIF(
          (CASE WHEN restaurant_rating IS NOT NULL THEN 1 ELSE 0 END
         + CASE WHEN food_rating IS NOT NULL THEN 1 ELSE 0 END),0),
    0)), 0)::numeric AS avg_rating,
    COUNT(*)::bigint AS rating_count
  FROM public.ratings
  WHERE restaurant_id = _restaurant_id
$$;
GRANT EXECUTE ON FUNCTION public.get_restaurant_rating_summary(uuid) TO anon, authenticated;

-- 5) Ratings insert only via RPC
DROP POLICY IF EXISTS "Customers can rate own orders" ON public.ratings;

CREATE UNIQUE INDEX IF NOT EXISTS ratings_order_customer_unique
  ON public.ratings(order_id, customer_id);

CREATE OR REPLACE FUNCTION public.submit_rating(
  _order_id uuid, _food_rating int, _restaurant_rating int,
  _rider_rating int, _review_text text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _order RECORD; _rating_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id, customer_id, status, restaurant_id, rider_id
    INTO _order FROM public.orders WHERE id = _order_id;
  IF _order.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF _order.customer_id <> auth.uid() THEN RAISE EXCEPTION 'Not your order'; END IF;
  IF _order.status <> 'delivered' THEN RAISE EXCEPTION 'Only delivered orders can be rated'; END IF;
  IF EXISTS (SELECT 1 FROM public.ratings WHERE order_id = _order_id AND customer_id = auth.uid()) THEN
    RAISE EXCEPTION 'You have already rated this order';
  END IF;
  IF _food_rating IS NOT NULL AND (_food_rating < 1 OR _food_rating > 5) THEN RAISE EXCEPTION 'Invalid food rating'; END IF;
  IF _restaurant_rating IS NOT NULL AND (_restaurant_rating < 1 OR _restaurant_rating > 5) THEN RAISE EXCEPTION 'Invalid restaurant rating'; END IF;
  IF _rider_rating IS NOT NULL AND (_rider_rating < 1 OR _rider_rating > 5) THEN RAISE EXCEPTION 'Invalid rider rating'; END IF;

  INSERT INTO public.ratings (
    order_id, customer_id, restaurant_id, rider_id,
    food_rating, restaurant_rating, rider_rating, review_text
  ) VALUES (
    _order_id, auth.uid(), _order.restaurant_id, _order.rider_id,
    _food_rating, _restaurant_rating, _rider_rating,
    NULLIF(TRIM(COALESCE(_review_text,'')), '')
  ) RETURNING id INTO _rating_id;

  RETURN _rating_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_rating(uuid,int,int,int,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_rating(uuid,int,int,int,text) FROM anon;

-- 6) rider_wallets: drop broad UPDATE, add RPC for payment info
DROP POLICY IF EXISTS "Riders can update own wallet payment info" ON public.rider_wallets;

CREATE OR REPLACE FUNCTION public.update_rider_payment_info(
  _bank_name text, _bank_account_number text, _bank_account_title text,
  _mobile_wallet_number text, _mobile_wallet_provider text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _rider_id uuid;
BEGIN
  SELECT id INTO _rider_id FROM public.riders WHERE user_id = auth.uid() LIMIT 1;
  IF _rider_id IS NULL THEN RAISE EXCEPTION 'Not a rider'; END IF;
  UPDATE public.rider_wallets
  SET bank_name = _bank_name,
      bank_account_number = _bank_account_number,
      bank_account_title = _bank_account_title,
      mobile_wallet_number = _mobile_wallet_number,
      mobile_wallet_provider = _mobile_wallet_provider,
      updated_at = now()
  WHERE rider_id = _rider_id;
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_rider_payment_info(text,text,text,text,text) TO authenticated;

-- 7) Restaurants approval lock trigger
CREATE OR REPLACE FUNCTION public.enforce_restaurant_approval_lock()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN NEW; END IF;
  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
    RAISE EXCEPTION 'Only admins can change approval status';
  END IF;
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'Only admins can activate/deactivate restaurants';
  END IF;
  IF NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
    RAISE EXCEPTION 'Only admins can change rejection reason';
  END IF;
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'Owner cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_enforce_restaurant_approval_lock ON public.restaurants;
CREATE TRIGGER trg_enforce_restaurant_approval_lock
  BEFORE UPDATE ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION public.enforce_restaurant_approval_lock();

-- 8) menu_categories: only active+approved
DROP POLICY IF EXISTS "Anyone can view menu categories" ON public.menu_categories;

CREATE POLICY "View menu categories for active approved restaurants"
  ON public.menu_categories FOR SELECT TO anon, authenticated
  USING (
    EXISTS (SELECT 1 FROM public.restaurants r
      WHERE r.id = menu_categories.restaurant_id
        AND r.is_active = true AND r.approval_status = 'approved')
    OR EXISTS (SELECT 1 FROM public.restaurants r
      WHERE r.id = menu_categories.restaurant_id AND r.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- 9) Orders / items / payments: RPC-only creation
DROP POLICY IF EXISTS "Customers can create orders" ON public.orders;
DROP POLICY IF EXISTS "Customers can create their own orders" ON public.orders;
DROP POLICY IF EXISTS "Customers can insert order items for their orders" ON public.order_items;
DROP POLICY IF EXISTS "Customers can create order items" ON public.order_items;
DROP POLICY IF EXISTS "Customers can insert payments for their orders" ON public.payments;
DROP POLICY IF EXISTS "Customers can create payments" ON public.payments;

CREATE OR REPLACE FUNCTION public.place_order(
  _restaurant_id uuid, _delivery_address text,
  _delivery_latitude numeric, _delivery_longitude numeric,
  _special_instructions text, _payment_method text,
  _items jsonb, _estimated_minutes int
) RETURNS TABLE(order_id uuid, order_number text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _restaurant RECORD; _item jsonb; _menu RECORD; _qty int;
  _subtotal numeric := 0; _delivery_fee numeric := 150;
  _total numeric; _distance_km numeric; _eta timestamptz; _new_order RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'Cart is empty'; END IF;
  IF _payment_method NOT IN ('cod','easypaisa','jazzcash','card','wallet') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;

  SELECT id, is_active, approval_status, latitude, longitude
    INTO _restaurant FROM public.restaurants WHERE id = _restaurant_id;
  IF _restaurant.id IS NULL THEN RAISE EXCEPTION 'Restaurant not found'; END IF;
  IF _restaurant.approval_status <> 'approved' OR _restaurant.is_active = false THEN
    RAISE EXCEPTION 'Restaurant not available';
  END IF;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := COALESCE((_item->>'quantity')::int, 0);
    IF _qty <= 0 OR _qty > 100 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
    SELECT id, name, price, restaurant_id, is_available INTO _menu
      FROM public.menu_items WHERE id = (_item->>'menu_item_id')::uuid;
    IF _menu.id IS NULL THEN RAISE EXCEPTION 'Menu item not found'; END IF;
    IF _menu.restaurant_id <> _restaurant_id THEN RAISE EXCEPTION 'Item does not belong to this restaurant'; END IF;
    IF _menu.is_available = false THEN RAISE EXCEPTION 'Item % no longer available', _menu.name; END IF;
    _subtotal := _subtotal + (_menu.price * _qty);
  END LOOP;

  IF _subtotal <= 0 THEN RAISE EXCEPTION 'Invalid subtotal'; END IF;

  IF _restaurant.latitude IS NOT NULL AND _restaurant.longitude IS NOT NULL
     AND _delivery_latitude IS NOT NULL AND _delivery_longitude IS NOT NULL THEN
    _distance_km := 6371 * acos(LEAST(1.0, GREATEST(-1.0,
      cos(radians(_restaurant.latitude)) * cos(radians(_delivery_latitude))
      * cos(radians(_delivery_longitude) - radians(_restaurant.longitude))
      + sin(radians(_restaurant.latitude)) * sin(radians(_delivery_latitude))
    )));
    IF _distance_km <= 4 THEN _delivery_fee := 150;
    ELSE _delivery_fee := 150 + (CEIL(_distance_km - 4) * 25); END IF;
  END IF;

  _total := _subtotal + _delivery_fee;
  _eta := now() + (COALESCE(GREATEST(_estimated_minutes, 15), 45) || ' minutes')::interval;

  INSERT INTO public.orders (
    customer_id, restaurant_id, delivery_address, delivery_latitude, delivery_longitude,
    subtotal, delivery_fee, total, special_instructions, estimated_delivery_time, status
  ) VALUES (
    auth.uid(), _restaurant_id, _delivery_address, _delivery_latitude, _delivery_longitude,
    _subtotal, _delivery_fee, _total,
    NULLIF(TRIM(COALESCE(_special_instructions,'')), ''), _eta, 'pending'
  ) RETURNING id, order_number INTO _new_order;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := (_item->>'quantity')::int;
    SELECT id, name, price INTO _menu
      FROM public.menu_items WHERE id = (_item->>'menu_item_id')::uuid;
    INSERT INTO public.order_items (
      order_id, menu_item_id, item_name, item_price, quantity, subtotal, special_instructions
    ) VALUES (
      _new_order.id, _menu.id, _menu.name, _menu.price,
      _qty, _menu.price * _qty,
      NULLIF(TRIM(COALESCE(_item->>'special_instructions','')), '')
    );
  END LOOP;

  INSERT INTO public.payments (order_id, amount, method, status)
  VALUES (_new_order.id, _total, _payment_method, 'pending');

  RETURN QUERY SELECT _new_order.id, _new_order.order_number;
END;
$$;
GRANT EXECUTE ON FUNCTION public.place_order(uuid,text,numeric,numeric,text,text,jsonb,int) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.place_order(uuid,text,numeric,numeric,text,text,jsonb,int) FROM anon;
