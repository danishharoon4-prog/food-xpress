
-- Helper functions to let restaurant owners see customer/rider info for their orders
CREATE OR REPLACE FUNCTION public.get_customer_ids_for_restaurant_owner(_owner_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT o.customer_id
  FROM public.orders o
  JOIN public.restaurants r ON r.id = o.restaurant_id
  WHERE r.owner_id = _owner_id
$$;

CREATE OR REPLACE FUNCTION public.get_rider_user_ids_for_restaurant_owner(_owner_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT ri.user_id
  FROM public.orders o
  JOIN public.restaurants r ON r.id = o.restaurant_id
  JOIN public.riders ri ON ri.id = o.rider_id
  WHERE r.owner_id = _owner_id
$$;

CREATE OR REPLACE FUNCTION public.get_rider_ids_for_restaurant_owner(_owner_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT o.rider_id
  FROM public.orders o
  JOIN public.restaurants r ON r.id = o.restaurant_id
  WHERE r.owner_id = _owner_id AND o.rider_id IS NOT NULL
$$;

CREATE POLICY "Restaurant owners can view customer profiles for their orders"
ON public.profiles FOR SELECT TO authenticated
USING (id IN (SELECT public.get_customer_ids_for_restaurant_owner(auth.uid())));

CREATE POLICY "Restaurant owners can view rider profiles for their orders"
ON public.profiles FOR SELECT TO authenticated
USING (id IN (SELECT public.get_rider_user_ids_for_restaurant_owner(auth.uid())));

CREATE POLICY "Restaurant owners can view assigned riders for their orders"
ON public.riders FOR SELECT TO authenticated
USING (id IN (SELECT public.get_rider_ids_for_restaurant_owner(auth.uid())));
