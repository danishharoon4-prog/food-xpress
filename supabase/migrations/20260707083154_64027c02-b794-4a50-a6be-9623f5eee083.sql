CREATE OR REPLACE FUNCTION public.count_available_riders_for_restaurant(_restaurant_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _city text;
  _count integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;

  SELECT owner_id, city INTO _owner, _city
  FROM public.restaurants WHERE id = _restaurant_id;

  IF _owner IS NULL THEN RETURN 0; END IF;

  IF _owner <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN 0;
  END IF;

  IF _city IS NULL THEN RETURN 0; END IF;

  SELECT COUNT(*) INTO _count
  FROM public.riders ri
  JOIN public.profiles p ON p.id = ri.user_id
  WHERE ri.is_online = true
    AND ri.is_verified = true
    AND p.city = _city;

  RETURN COALESCE(_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.count_available_riders_for_restaurant(uuid) TO authenticated;