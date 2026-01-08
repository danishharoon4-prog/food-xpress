-- Allow customers to view their order's assigned rider (for live tracking)
CREATE POLICY "Customers can view assigned rider for their orders" 
ON public.riders 
FOR SELECT 
USING (
  id IN (
    SELECT rider_id FROM orders 
    WHERE customer_id = auth.uid() 
    AND rider_id IS NOT NULL
  )
);