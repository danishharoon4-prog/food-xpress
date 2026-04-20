
-- Add cancellation reason column to orders table
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS cancellation_reason text,
ADD COLUMN IF NOT EXISTS cancelled_by uuid,
ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone;

-- Function to allow customer to cancel their own order (only when pending or confirmed)
CREATE OR REPLACE FUNCTION public.cancel_order(_order_id uuid, _reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _is_admin boolean;
  _order RECORD;
BEGIN
  SELECT public.has_role(auth.uid(), 'admin'::app_role) INTO _is_admin;

  SELECT id, customer_id, status INTO _order
  FROM public.orders WHERE id = _order_id;

  IF _order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Only customer (own order) or admin can cancel
  IF NOT _is_admin AND _order.customer_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not allowed to cancel this order';
  END IF;

  -- Only allow cancellation while pending or confirmed (before preparing)
  IF _order.status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'Order can only be cancelled before it is being prepared';
  END IF;

  UPDATE public.orders
  SET status = 'cancelled',
      cancellation_reason = _reason,
      cancelled_by = auth.uid(),
      cancelled_at = now(),
      updated_at = now()
  WHERE id = _order_id;

  RETURN true;
END;
$$;
