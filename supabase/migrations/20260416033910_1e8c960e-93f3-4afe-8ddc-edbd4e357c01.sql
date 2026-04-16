CREATE POLICY "Customers can create payments for own orders"
ON public.payments FOR INSERT
TO public
WITH CHECK (
  order_id IN (
    SELECT id FROM public.orders WHERE customer_id = auth.uid()
  )
);