
-- Allow riders to see unassigned ready_for_pickup orders
CREATE POLICY "Riders can view available orders for pickup"
ON public.orders FOR SELECT
TO authenticated
USING (
  status = 'ready_for_pickup'
  AND rider_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.riders
    WHERE riders.user_id = auth.uid()
      AND riders.is_online = true
  )
);

-- Secure function for rider to claim an order
CREATE OR REPLACE FUNCTION public.claim_order(_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rider_id uuid;
BEGIN
  -- Get rider id for current user (must be online)
  SELECT id INTO _rider_id
  FROM public.riders
  WHERE user_id = auth.uid() AND is_online = true
  LIMIT 1;

  IF _rider_id IS NULL THEN
    RAISE EXCEPTION 'Rider not found or not online';
  END IF;

  -- Claim the order only if still unassigned and ready_for_pickup
  UPDATE public.orders
  SET rider_id = _rider_id,
      status = 'picked_up',
      updated_at = now()
  WHERE id = _order_id
    AND status = 'ready_for_pickup'
    AND rider_id IS NULL;

  IF NOT FOUND THEN
    RETURN false; -- Already claimed or not available
  END IF;

  RETURN true;
END;
$$;
