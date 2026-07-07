ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_self_delivery boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.mark_ready_for_pickup(_order_id uuid, _self_delivery boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _order RECORD;
  _restaurant RECORD;
  _rider RECORD;
  _order_short text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT o.id, o.restaurant_id, o.status, o.subtotal, o.order_number, o.customer_id
    INTO _order
  FROM public.orders o WHERE o.id = _order_id;
  IF _order.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;

  SELECT r.id, r.owner_id, r.name, r.city
    INTO _restaurant
  FROM public.restaurants r WHERE r.id = _order.restaurant_id;
  IF _restaurant.owner_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF _order.status NOT IN ('preparing','confirmed','pending') THEN
    RAISE EXCEPTION 'Order cannot be marked ready in current status: %', _order.status;
  END IF;

  _order_short := COALESCE(_order.order_number, LEFT(_order.id::text, 8));

  IF _self_delivery THEN
    UPDATE public.orders
    SET status = 'on_the_way',
        is_self_delivery = true,
        delivery_fee = 0,
        total = subtotal,
        rider_id = NULL,
        updated_at = now()
    WHERE id = _order_id;
  ELSE
    UPDATE public.orders
    SET status = 'ready_for_pickup',
        is_self_delivery = false,
        updated_at = now()
    WHERE id = _order_id;

    -- Notify all online + verified riders in the restaurant's city
    FOR _rider IN
      SELECT ri.user_id
      FROM public.riders ri
      JOIN public.profiles p ON p.id = ri.user_id
      WHERE ri.is_online = true
        AND ri.is_verified = true
        AND p.city = _restaurant.city
    LOOP
      INSERT INTO public.notifications (user_id, title, message, type, data)
      VALUES (
        _rider.user_id,
        'New Delivery Available',
        'Order #' || _order_short || ' from ' || COALESCE(_restaurant.name,'a restaurant') || ' is ready for pickup.',
        'info',
        jsonb_build_object('order_id', _order_id, 'status', 'ready_for_pickup')
      );
    END LOOP;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_ready_for_pickup(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_ready_for_pickup(uuid, boolean) TO authenticated;