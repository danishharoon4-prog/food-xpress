
-- Create a SECURITY DEFINER function to check rider ownership without triggering orders RLS
CREATE OR REPLACE FUNCTION public.get_rider_id_for_user(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.riders WHERE user_id = _user_id
$$;

-- Create a SECURITY DEFINER function to get rider_ids from user's orders (breaks recursion from riders side)
CREATE OR REPLACE FUNCTION public.get_rider_ids_for_customer_orders(_customer_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rider_id FROM public.orders WHERE customer_id = _customer_id AND rider_id IS NOT NULL
$$;

-- Drop the problematic policies
DROP POLICY IF EXISTS "Riders can view assigned orders" ON public.orders;
DROP POLICY IF EXISTS "Riders can update assigned orders" ON public.orders;
DROP POLICY IF EXISTS "Customers can view assigned rider for their orders" ON public.riders;

-- Recreate orders policies using the SECURITY DEFINER function (no recursion)
CREATE POLICY "Riders can view assigned orders"
ON public.orders FOR SELECT TO authenticated
USING (rider_id IN (SELECT public.get_rider_id_for_user(auth.uid())));

CREATE POLICY "Riders can update assigned orders"
ON public.orders FOR UPDATE TO authenticated
USING (rider_id IN (SELECT public.get_rider_id_for_user(auth.uid())));

-- Recreate riders policy using the SECURITY DEFINER function (no recursion)
CREATE POLICY "Customers can view assigned rider for their orders"
ON public.riders FOR SELECT TO authenticated
USING (id IN (SELECT public.get_rider_ids_for_customer_orders(auth.uid())));
