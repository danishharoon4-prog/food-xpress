CREATE OR REPLACE FUNCTION public.update_order_eta(_order_id uuid, _new_eta timestamp with time zone)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rider_id uuid;
  _order RECORD;
  _admin RECORD;
  _order_short text;
  _eta_local text;
BEGIN
  SELECT id INTO _rider_id FROM public.riders WHERE user_id = auth.uid() LIMIT 1;
  IF _rider_id IS NULL THEN
    RAISE EXCEPTION 'Not a rider';
  END IF;

  UPDATE public.orders
  SET estimated_delivery_time = _new_eta,
      updated_at = now()
  WHERE id = _order_id
    AND rider_id = _rider_id
    AND status NOT IN ('delivered','cancelled')
  RETURNING id, order_number, customer_id INTO _order;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  _order_short := COALESCE(_order.order_number, LEFT(_order.id::text, 8));
  _eta_local := to_char(_new_eta AT TIME ZONE 'Asia/Karachi', 'HH12:MI AM');

  -- Notify customer
  IF _order.customer_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, data)
    VALUES (
      _order.customer_id,
      'Arrival Time Updated',
      'Rider updated the arrival time for order #' || _order_short || '. New ETA: ' || _eta_local || '.',
      'info',
      jsonb_build_object('order_id', _order.id, 'new_eta', _new_eta)
    );
  END IF;

  -- Notify admins
  FOR _admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin'::app_role LOOP
    INSERT INTO public.notifications (user_id, title, message, type, data)
    VALUES (
      _admin.user_id,
      'Arrival Time Updated',
      'Rider updated ETA for order #' || _order_short || ' to ' || _eta_local || '.',
      'info',
      jsonb_build_object('order_id', _order.id, 'new_eta', _new_eta)
    );
  END LOOP;

  RETURN true;
END;
$$;