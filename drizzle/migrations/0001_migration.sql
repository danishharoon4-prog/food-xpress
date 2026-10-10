CREATE OR REPLACE FUNCTION public.mark_ready_for_pickup(_order_id uuid, _self_delivery boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _order RECORD;
  _restaurant RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT o.id, o.restaurant_id, o.status INTO _order FROM public.orders o WHERE o.id = _order_id;
  IF _order.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  SELECT r.id, r.owner_id INTO _restaurant FROM public.restaurants r WHERE r.id = _order.restaurant_id;
  IF _restaurant.owner_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _order.status NOT IN ('preparing','confirmed','pending') THEN
    RAISE EXCEPTION 'Order cannot be marked ready in current status: %', _order.status;
  END IF;
  IF _self_delivery THEN
    UPDATE public.orders SET status = 'on_the_way', is_self_delivery = true, delivery_fee = 0,
      total = subtotal, rider_id = NULL, updated_at = now() WHERE id = _order_id;
  ELSE
    -- Rider alerts are sent by trg_notify_riders_new_delivery
    UPDATE public.orders SET status = 'ready_for_pickup', is_self_delivery = false, updated_at = now()
    WHERE id = _order_id;
  END IF;
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_riders_new_delivery()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _r RECORD;
  _rider RECORD;
  _short text;
BEGIN
  IF NEW.status <> 'ready_for_pickup' OR OLD.status = 'ready_for_pickup'
     OR COALESCE(NEW.is_self_delivery,false) OR NEW.rider_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT name, city INTO _r FROM public.restaurants WHERE id = NEW.restaurant_id;
  _short := COALESCE(NEW.order_number, LEFT(NEW.id::text, 8));
  FOR _rider IN
    SELECT ri.user_id FROM public.riders ri JOIN public.profiles p ON p.id = ri.user_id
    WHERE ri.is_online = true AND ri.is_verified = true
      AND lower(trim(COALESCE(p.city,''))) = lower(trim(COALESCE(_r.city,'')))
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, data)
    VALUES (_rider.user_id, 'New Order Available in Your City',
      'Order #' || _short || ' from ' || COALESCE(_r.name,'a restaurant') || ' is ready for pickup.',
      'info', jsonb_build_object('order_id', NEW.id, 'status', 'ready_for_pickup'));
  END LOOP;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_riders_new_delivery ON public.orders;
CREATE TRIGGER trg_notify_riders_new_delivery AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_riders_new_delivery();