CREATE OR REPLACE FUNCTION public.cancel_order(_order_id uuid, _reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _is_admin boolean;
  _order RECORD;
  _admin RECORD;
BEGIN
  SELECT public.has_role(auth.uid(), 'admin'::app_role) INTO _is_admin;

  SELECT id, customer_id, status, order_number INTO _order
  FROM public.orders WHERE id = _order_id;

  IF _order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF NOT _is_admin AND _order.customer_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not allowed to cancel this order';
  END IF;

  IF _order.status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'Order can only be cancelled before it is being prepared';
  END IF;

  UPDATE public.orders
  SET status = 'cancelled',
      cancellation_reason = _reason,
      cancelled_by = auth.uid(),
      cancelled_at = now(),
      updated_at = now()
  WHERE id = _order_id;

  -- Notifications
  IF _is_admin THEN
    -- Notify the customer
    INSERT INTO public.notifications (user_id, title, message, type, data)
    VALUES (
      _order.customer_id,
      'Order Cancelled by Admin',
      'Your order #' || _order.order_number || ' has been cancelled. Reason: ' || _reason,
      'warning',
      jsonb_build_object('order_id', _order_id, 'reason', _reason, 'cancelled_by', 'admin')
    );
  ELSE
    -- Notify all admins
    FOR _admin IN
      SELECT user_id FROM public.user_roles WHERE role = 'admin'::app_role
    LOOP
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
$$;