-- 1. Validation trigger for order_items to prevent price manipulation
CREATE OR REPLACE FUNCTION public.validate_order_item_prices()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actual_price numeric;
BEGIN
  IF NEW.menu_item_id IS NOT NULL THEN
    SELECT price INTO actual_price FROM public.menu_items WHERE id = NEW.menu_item_id;
    IF FOUND AND actual_price IS NOT NULL THEN
      IF NEW.item_price != actual_price THEN
        RAISE EXCEPTION 'Item price does not match menu item price. Expected %, got %', actual_price, NEW.item_price;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger to order_items
DROP TRIGGER IF EXISTS validate_order_item_prices_trigger ON public.order_items;
CREATE TRIGGER validate_order_item_prices_trigger
  BEFORE INSERT OR UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_order_item_prices();

-- 2. Secure realtime: remove notifications from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.notifications;

-- 3. Add RLS policy on realtime.messages for orders
CREATE POLICY "orders_realtime_scoped"
ON realtime.messages FOR SELECT TO authenticated
USING (
  realtime.topic() NOT LIKE 'realtime:public:orders%'
  OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(payload) AS msg
    WHERE (
      (msg->>'customer_id')::uuid = auth.uid()
      OR (msg->>'rider_id') IN (
        SELECT id::text FROM public.riders WHERE user_id = auth.uid()
      )
      OR public.has_role(auth.uid(), 'admin')
    )
  )
);