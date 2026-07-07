CREATE OR REPLACE FUNCTION public.notify_restaurant_availability()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _title text;
  _message text;
  _type text := 'info';
  _should_notify boolean := false;
  _customer RECORD;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- New restaurant that is already approved AND active on insert
    IF NEW.approval_status = 'approved' AND COALESCE(NEW.is_active, false) = true THEN
      _title := 'New Restaurant Available';
      _message := COALESCE(NEW.name, 'A new restaurant') || ' just joined'
                  || CASE WHEN NEW.city IS NOT NULL THEN ' in ' || NEW.city ELSE '' END
                  || '. Check out the menu!';
      _type := 'success';
      _should_notify := true;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Just approved (and active)
    IF NEW.approval_status = 'approved'
       AND OLD.approval_status IS DISTINCT FROM 'approved'
       AND COALESCE(NEW.is_active, false) = true THEN
      _title := 'New Restaurant Available';
      _message := COALESCE(NEW.name, 'A new restaurant') || ' just joined'
                  || CASE WHEN NEW.city IS NOT NULL THEN ' in ' || NEW.city ELSE '' END
                  || '. Check out the menu!';
      _type := 'success';
      _should_notify := true;
    -- Reopened (already approved, active flipped false -> true)
    ELSIF NEW.approval_status = 'approved'
       AND COALESCE(OLD.is_active, false) = false
       AND COALESCE(NEW.is_active, false) = true THEN
      _title := 'Restaurant Reopened';
      _message := COALESCE(NEW.name, 'A restaurant') || ' is accepting orders again.';
      _type := 'success';
      _should_notify := true;
    -- Closed (approved, active flipped true -> false)
    ELSIF NEW.approval_status = 'approved'
       AND COALESCE(OLD.is_active, false) = true
       AND COALESCE(NEW.is_active, false) = false THEN
      _title := 'Restaurant Temporarily Closed';
      _message := COALESCE(NEW.name, 'A restaurant') || ' is not accepting orders right now.';
      _type := 'warning';
      _should_notify := true;
    END IF;
  END IF;

  IF _should_notify THEN
    FOR _customer IN
      SELECT ur.user_id
      FROM public.user_roles ur
      WHERE ur.role = 'customer'::app_role
    LOOP
      INSERT INTO public.notifications (user_id, title, message, type, data)
      VALUES (
        _customer.user_id,
        _title,
        _message,
        _type,
        jsonb_build_object('restaurant_id', NEW.id, 'event',
          CASE
            WHEN _title = 'Restaurant Reopened' THEN 'reopened'
            WHEN _title = 'Restaurant Temporarily Closed' THEN 'closed'
            ELSE 'new_restaurant'
          END
        )
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_restaurant_availability_ins ON public.restaurants;
DROP TRIGGER IF EXISTS trg_notify_restaurant_availability_upd ON public.restaurants;

CREATE TRIGGER trg_notify_restaurant_availability_ins
AFTER INSERT ON public.restaurants
FOR EACH ROW EXECUTE FUNCTION public.notify_restaurant_availability();

CREATE TRIGGER trg_notify_restaurant_availability_upd
AFTER UPDATE ON public.restaurants
FOR EACH ROW EXECUTE FUNCTION public.notify_restaurant_availability();