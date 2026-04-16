
-- Add new enum value for awaiting_confirmation
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'awaiting_confirmation' BEFORE 'delivered';

-- Allow customers to update their own orders (for confirming delivery)
CREATE POLICY "Customers can update own orders"
ON public.orders FOR UPDATE
TO authenticated
USING (auth.uid() = customer_id)
WITH CHECK (auth.uid() = customer_id);

-- Function for customer to confirm delivery
CREATE OR REPLACE FUNCTION public.confirm_delivery(_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow the customer who owns the order to confirm
  UPDATE public.orders
  SET status = 'delivered',
      actual_delivery_time = now(),
      updated_at = now()
  WHERE id = _order_id
    AND customer_id = auth.uid()
    AND status = 'awaiting_confirmation';

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Mark payment as completed
  UPDATE public.payments
  SET status = 'completed', updated_at = now()
  WHERE order_id = _order_id;

  -- Update rider earnings and stats
  DECLARE
    _rider_id uuid;
    _order_record RECORD;
    _earning_amount numeric;
  BEGIN
    SELECT rider_id, delivery_fee, order_number INTO _order_record
    FROM public.orders WHERE id = _order_id;

    _rider_id := _order_record.rider_id;
    _earning_amount := COALESCE(_order_record.delivery_fee, 50);

    IF _rider_id IS NOT NULL THEN
      INSERT INTO public.rider_earnings (rider_id, order_id, amount, description, distance_km)
      VALUES (_rider_id, _order_id, _earning_amount, 'Delivery for order #' || _order_record.order_number, 3);

      UPDATE public.rider_wallets
      SET balance = COALESCE(balance, 0) + _earning_amount,
          total_earned = COALESCE(total_earned, 0) + _earning_amount
      WHERE rider_id = _rider_id;

      UPDATE public.riders
      SET total_deliveries = COALESCE(total_deliveries, 0) + 1
      WHERE id = _rider_id;
    END IF;
  END;

  RETURN true;
END;
$$;
