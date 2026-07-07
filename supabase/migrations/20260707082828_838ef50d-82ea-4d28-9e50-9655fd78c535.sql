CREATE OR REPLACE FUNCTION public.get_restaurant_phone_for_order(_order_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _owner uuid;
  _rider_user uuid;
  _phone text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;

  SELECT r.owner_id, ri.user_id
    INTO _owner, _rider_user
  FROM public.orders o
  JOIN public.restaurants r ON r.id = o.restaurant_id
  LEFT JOIN public.riders ri ON ri.id = o.rider_id
  WHERE o.id = _order_id;

  IF _owner IS NULL THEN RETURN NULL; END IF;

  -- Only the assigned rider (or admins) may look up the restaurant phone
  IF auth.uid() <> COALESCE(_rider_user, '00000000-0000-0000-0000-000000000000'::uuid)
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NULL;
  END IF;

  SELECT phone INTO _phone FROM public.profiles WHERE id = _owner;
  RETURN _phone;
END;
$function$;