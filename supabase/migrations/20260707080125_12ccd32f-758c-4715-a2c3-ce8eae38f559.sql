CREATE OR REPLACE FUNCTION public.cancel_order(_order_id uuid, _reason text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _is_admin boolean;
  _is_restaurant_owner boolean := false;
  _order RECORD;
  _restaurant RECORD;
  _admin RECORD;
  _cancelled_by_label text;
BEGIN
  SELECT public.has_role(auth.uid(), 'admin'::app_role) INTO _is_admin;

  SELECT id, customer_id, status, order_number, restaurant_id
    INTO _order
  FROM public.orders WHERE id = _order_id;

  IF _order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  SELECT r.id, r.owner_id, r.name INTO _restaurant
  FROM public.restaurants r WHERE r.id = _order.restaurant_id;

  IF _restaurant.owner_id = auth.uid() THEN
    _is_restaurant_owner := true;
  END IF;

  IF NOT _is_admin
     AND NOT _is_restaurant_owner
     AND _order.customer_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not allowed to cancel this order';
  END IF;

  -- Customer can only cancel before preparation begins.
  -- Restaurant owner / admin can cancel any time before pickup.
  IF _is_admin OR _is_restaurant_owner THEN
    IF _order.status NOT IN ('pending','confirmed','preparing','ready_for_pickup') THEN
      RAISE EXCEPTION 'Order can no longer be cancelled (already picked up or completed)';
    END IF;
  ELSE
    IF _order.status NOT IN ('pending','confirmed') THEN
      RAISE EXCEPTION 'Order can only be cancelled before it is being prepared';
    END IF;
  END IF;

  UPDATE public.orders
  SET status = 'cancelled',
      cancellation_reason = _reason,
      cancelled_by = auth.uid(),
      cancelled_at = now(),
      updated_at = now()
  WHERE id = _order_id;

  -- Refund any pending payment
  UPDATE public.payments
  SET status = 'refunded', updated_at = now()
  WHERE order_id = _order_id AND status IN ('pending','completed');

  _cancelled_by_label := CASE
    WHEN _is_admin THEN 'admin'
    WHEN _is_restaurant_owner THEN 'restaurant'
    ELSE 'customer'
  END;

  IF _is_admin THEN
    INSERT INTO public.notifications (user_id, title, message, type, data)
    VALUES (
      _order.customer_id,
      'Order Cancelled by Admin',
      'Your order #' || _order.order_number || ' has been cancelled. Reason: ' || _reason,
      'warning',
      jsonb_build_object('order_id', _order_id, 'reason', _reason, 'cancelled_by', 'admin')
    );
  ELSIF _is_restaurant_owner THEN
    -- Notify customer
    INSERT INTO public.notifications (user_id, title, message, type, data)
    VALUES (
      _order.customer_id,
      'Order Cancelled by Restaurant',
      'Sorry — ' || COALESCE(_restaurant.name,'the restaurant') || ' cannot fulfil order #' || _order.order_number || '. Reason: ' || _reason,
      'warning',
      jsonb_build_object('order_id', _order_id, 'reason', _reason, 'cancelled_by', 'restaurant')
    );
    -- Notify admins
    FOR _admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin'::app_role LOOP
      INSERT INTO public.notifications (user_id, title, message, type, data)
      VALUES (
        _admin.user_id,
        'Order Cancelled by Restaurant',
        'Order #' || _order.order_number || ' was cancelled by ' || COALESCE(_restaurant.name,'the restaurant') || '. Reason: ' || _reason,
        'warning',
        jsonb_build_object('order_id', _order_id, 'reason', _reason, 'cancelled_by', 'restaurant')
      );
    END LOOP;
  ELSE
    -- Notify restaurant owner
    IF _restaurant.owner_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, data)
      VALUES (
        _restaurant.owner_id,
        'Order Cancelled by Customer',
        'Order #' || _order.order_number || ' was cancelled by the customer. Reason: ' || _reason,
        'warning',
        jsonb_build_object('order_id', _order_id, 'reason', _reason, 'cancelled_by', 'customer')
      );
    END IF;
    -- Notify admins
    FOR _admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin'::app_role LOOP
      INSERT INTO public.notifications (user_id, title, message, type, data)
      VALUES (
        _admin.user_id,
        'Order Cancelled by Customer',
        'Order #' || _order.order_number || ' was cancelled by the customer. Reason: ' || _reason,
        'warning',
        jsonb_build_object('order_id', _order_id, 'reason', _reason, 'cancelled_by', 'customer')
      );
    END LOOP;
  END IF;

  RETURN true;
END;
$function$;