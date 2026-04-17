-- Helper: rider IDs assigned to a customer's orders (already exists)
-- Helper: customer IDs whose orders are assigned to a rider
CREATE OR REPLACE FUNCTION public.get_customer_ids_for_rider(_rider_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT o.customer_id
  FROM public.orders o
  JOIN public.riders r ON r.id = o.rider_id
  WHERE r.user_id = _rider_user_id
$$;

-- Helper: user IDs of riders assigned to a customer's orders
CREATE OR REPLACE FUNCTION public.get_rider_user_ids_for_customer(_customer_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT r.user_id
  FROM public.orders o
  JOIN public.riders r ON r.id = o.rider_id
  WHERE o.customer_id = _customer_id
$$;

-- Allow riders to view customer profiles for their assigned orders
DROP POLICY IF EXISTS "Riders can view customer profiles for assigned orders" ON public.profiles;
CREATE POLICY "Riders can view customer profiles for assigned orders"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id IN (SELECT public.get_customer_ids_for_rider(auth.uid()))
);

-- Allow customers to view rider profiles for their orders
DROP POLICY IF EXISTS "Customers can view rider profiles for their orders" ON public.profiles;
CREATE POLICY "Customers can view rider profiles for their orders"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id IN (SELECT public.get_rider_user_ids_for_customer(auth.uid()))
);