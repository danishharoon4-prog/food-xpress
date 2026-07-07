
-- Trigger: on order status change, notify customer, admins, restaurant owner, and rider (if assigned)

CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _restaurant_name text;
  _restaurant_owner uuid;
  _rider_user_id uuid;
  _admin RECORD;
  _customer_title text;
  _customer_msg text;
  _staff_title text;
  _staff_msg text;
  _type text := 'info';
  _order_short text;
BEGIN
  -- Only run when status actually changed
  IF TG_OP <> 'UPDATE' OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT r.name, r.owner_id INTO _restaurant_name, _restaurant_owner
  FROM public.restaurants r WHERE r.id = NEW.restaurant_id;

  IF NEW.rider_id IS NOT NULL THEN
    SELECT user_id INTO _rider_user_id FROM public.riders WHERE id = NEW.rider_id;
  END IF;

  _order_short := COALESCE(NEW.order_number, LEFT(NEW.id::text, 8));

  -- Build human-friendly messages per status
  CASE NEW.status
    WHEN 'confirmed' THEN
      _customer_title := 'Order Confirmed';
      _customer_msg   := 'Your order #' || _order_short || ' has been confirmed by ' || COALESCE(_restaurant_name, 'the restaurant') || '.';
      _staff_title    := 'Order Confirmed';
      _staff_msg      := 'Order #' || _order_short || ' has been confirmed.';
      _type := 'success';
    WHEN 'preparing' THEN
      _customer_title := 'Order Being Prepared';
      _customer_msg   := COALESCE(_restaurant_name, 'The restaurant') || ' is preparing your order #' || _order_short || '.';
      _staff_title    := 'Order Preparing';
      _staff_msg      := 'Order #' || _order_short || ' is now being prepared.';
      _type := 'info';
    WHEN 'ready_for_pickup' THEN
      _customer_title := 'Order Ready';
      _customer_msg   := 'Your order #' || _order_short || ' is ready and waiting for a rider.';
      _staff_title    := 'Ready for Pickup';
      _staff_msg      := 'Order #' || _order_short || ' is ready for pickup.';
      _type := 'info';
    WHEN 'picked_up' THEN
      _customer_title := 'Rider Assigned & Order Picked Up';
      _customer_msg   := 'A rider has picked up your order #' || _order_short || '.';
      _staff_title    := 'Order Picked Up';
      _staff_msg      := 'Order #' || _order_short || ' has been picked up by the rider.';
      _type := 'success';
    WHEN 'on_the_way' THEN
      _customer_title := 'Order On The Way';
      _customer_msg   := 'Your order #' || _order_short || ' is on the way!';
      _staff_title    := 'Order On The Way';
      _staff_msg      := 'Order #' || _order_short || ' is on the way to the customer.';
      _type := 'info';
    WHEN 'awaiting_confirmation' THEN
      _customer_title := 'Confirm Delivery';
      _customer_msg   := 'Rider marked order #' || _order_short || ' as delivered. Please confirm.';
      _staff_title    := 'Awaiting Customer Confirmation';
      _staff_msg      := 'Order #' || _order_short || ' is awaiting customer confirmation.';
      _type := 'info';
    WHEN 'delivered' THEN
      _customer_title := 'Order Delivered';
      _customer_msg   := 'Your order #' || _order_short || ' has been delivered. Enjoy your meal!';
      _staff_title    := 'Order Delivered';
      _staff_msg      := 'Order #' || _order_short || ' has been delivered.';
      _type := 'success';
    WHEN 'cancelled' THEN
      _customer_title := 'Order Cancelled';
      _customer_msg   := 'Order #' || _order_short || ' has been cancelled.';
      _staff_title    := 'Order Cancelled';
      _staff_msg      := 'Order #' || _order_short || ' has been cancelled.';
      _type := 'warning';
    ELSE
      _customer_title := 'Order Update';
      _customer_msg   := 'Your order #' || _order_short || ' status: ' || NEW.status || '.';
      _staff_title    := 'Order Update';
      _staff_msg      := 'Order #' || _order_short || ' status: ' || NEW.status || '.';
      _type := 'info';
  END CASE;

  -- Notify customer
  IF NEW.customer_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, data)
    VALUES (NEW.customer_id, _customer_title, _customer_msg, _type,
      jsonb_build_object('order_id', NEW.id, 'status', NEW.status));
  END IF;

  -- Notify restaurant owner
  IF _restaurant_owner IS NOT NULL AND _restaurant_owner <> NEW.customer_id THEN
    INSERT INTO public.notifications (user_id, title, message, type, data)
    VALUES (_restaurant_owner, _staff_title, _staff_msg, _type,
      jsonb_build_object('order_id', NEW.id, 'status', NEW.status));
  END IF;

  -- Notify rider (if assigned)
  IF _rider_user_id IS NOT NULL AND _rider_user_id <> NEW.customer_id THEN
    INSERT INTO public.notifications (user_id, title, message, type, data)
    VALUES (_rider_user_id, _staff_title, _staff_msg, _type,
      jsonb_build_object('order_id', NEW.id, 'status', NEW.status));
  END IF;

  -- Notify all admins
  FOR _admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin'::app_role LOOP
    INSERT INTO public.notifications (user_id, title, message, type, data)
    VALUES (_admin.user_id, _staff_title,
            _staff_msg || ' (Customer order)', _type,
            jsonb_build_object('order_id', NEW.id, 'status', NEW.status));
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_order_status_change ON public.orders;
CREATE TRIGGER trg_notify_order_status_change
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_order_status_change();

-- Also notify on new order (pending) so restaurant + admins hear about it immediately
CREATE OR REPLACE FUNCTION public.notify_order_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _restaurant_name text;
  _restaurant_owner uuid;
  _admin RECORD;
  _order_short text;
BEGIN
  SELECT r.name, r.owner_id INTO _restaurant_name, _restaurant_owner
  FROM public.restaurants r WHERE r.id = NEW.restaurant_id;

  _order_short := COALESCE(NEW.order_number, LEFT(NEW.id::text, 8));

  -- Customer confirmation
  IF NEW.customer_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, data)
    VALUES (NEW.customer_id, 'Order Placed',
      'Your order #' || _order_short || ' has been placed successfully.', 'success',
      jsonb_build_object('order_id', NEW.id, 'status', NEW.status));
  END IF;

  -- Restaurant owner
  IF _restaurant_owner IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, data)
    VALUES (_restaurant_owner, 'New Order Received',
      'You have received a new order #' || _order_short || '.', 'info',
      jsonb_build_object('order_id', NEW.id, 'status', NEW.status));
  END IF;

  -- Admins
  FOR _admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin'::app_role LOOP
    INSERT INTO public.notifications (user_id, title, message, type, data)
    VALUES (_admin.user_id, 'New Order',
      'New order #' || _order_short || ' at ' || COALESCE(_restaurant_name, 'restaurant') || '.', 'info',
      jsonb_build_object('order_id', NEW.id, 'status', NEW.status));
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_order_created ON public.orders;
CREATE TRIGGER trg_notify_order_created
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_order_created();
