CREATE OR REPLACE FUNCTION public.place_order(_restaurant_id uuid, _delivery_address text, _delivery_latitude numeric, _delivery_longitude numeric, _special_instructions text, _payment_method text, _items jsonb, _estimated_minutes integer)
 RETURNS TABLE(order_id uuid, order_number text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _restaurant RECORD; _item jsonb; _menu RECORD; _qty int;
  _subtotal numeric := 0; _delivery_fee numeric := 150;
  _total numeric; _distance_km numeric; _eta timestamptz;
  _new_id uuid; _new_number text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'Cart is empty'; END IF;
  IF _payment_method NOT IN ('cod','easypaisa','jazzcash','card','wallet') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;

  SELECT r.id, r.is_active, r.approval_status, r.latitude, r.longitude
    INTO _restaurant FROM public.restaurants r WHERE r.id = _restaurant_id;
  IF _restaurant.id IS NULL THEN RAISE EXCEPTION 'Restaurant not found'; END IF;
  IF _restaurant.approval_status <> 'approved' OR _restaurant.is_active = false THEN
    RAISE EXCEPTION 'Restaurant not available';
  END IF;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := COALESCE((_item->>'quantity')::int, 0);
    IF _qty <= 0 OR _qty > 100 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
    SELECT mi.id, mi.name, mi.price, mi.restaurant_id, mi.is_available INTO _menu
      FROM public.menu_items mi WHERE mi.id = (_item->>'menu_item_id')::uuid;
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
  ) RETURNING orders.id, orders.order_number INTO _new_id, _new_number;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := (_item->>'quantity')::int;
    SELECT mi.id, mi.name, mi.price INTO _menu
      FROM public.menu_items mi WHERE mi.id = (_item->>'menu_item_id')::uuid;
    INSERT INTO public.order_items (
      order_id, menu_item_id, item_name, item_price, quantity, subtotal, special_instructions
    ) VALUES (
      _new_id, _menu.id, _menu.name, _menu.price,
      _qty, _menu.price * _qty,
      NULLIF(TRIM(COALESCE(_item->>'special_instructions','')), '')
    );
  END LOOP;

  INSERT INTO public.payments (order_id, amount, method, status)
  VALUES (_new_id, _total, _payment_method::public.payment_method, 'pending');

  order_id := _new_id;
  order_number := _new_number;
  RETURN NEXT;
END;
$function$;