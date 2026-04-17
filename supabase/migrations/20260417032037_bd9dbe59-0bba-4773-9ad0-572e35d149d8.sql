-- Helper function: get the city of the currently authenticated rider's profile
CREATE OR REPLACE FUNCTION public.get_current_rider_city()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.city
  FROM public.profiles p
  INNER JOIN public.riders r ON r.user_id = p.id
  WHERE p.id = auth.uid()
  LIMIT 1
$$;

-- Replace the existing "available for pickup" policy with a city-scoped one
DROP POLICY IF EXISTS "Riders can view available orders for pickup" ON public.orders;

CREATE POLICY "Riders can view available orders for pickup"
ON public.orders
FOR SELECT
TO authenticated
USING (
  status = 'ready_for_pickup'
  AND rider_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.riders
    WHERE riders.user_id = auth.uid()
      AND riders.is_online = true
  )
  AND restaurant_id IN (
    SELECT id FROM public.restaurants
    WHERE city IS NOT NULL
      AND city = public.get_current_rider_city()
  )
);

-- Also harden claim_order so a rider cannot claim an order outside their city
CREATE OR REPLACE FUNCTION public.claim_order(_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rider_id uuid;
  _rider_city text;
BEGIN
  -- Get rider id + city for current user (must be online)
  SELECT r.id, p.city
    INTO _rider_id, _rider_city
  FROM public.riders r
  JOIN public.profiles p ON p.id = r.user_id
  WHERE r.user_id = auth.uid() AND r.is_online = true
  LIMIT 1;

  IF _rider_id IS NULL THEN
    RAISE EXCEPTION 'Rider not found or not online';
  END IF;

  -- Claim only if same city as restaurant
  UPDATE public.orders o
  SET rider_id = _rider_id,
      status = 'picked_up',
      updated_at = now()
  WHERE o.id = _order_id
    AND o.status = 'ready_for_pickup'
    AND o.rider_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = o.restaurant_id
        AND r.city IS NOT NULL
        AND r.city = _rider_city
    );

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;