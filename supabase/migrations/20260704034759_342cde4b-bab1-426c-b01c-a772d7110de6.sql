
DROP POLICY IF EXISTS "Anyone can view ratings" ON public.ratings;

CREATE POLICY "Customers can view their own ratings"
ON public.ratings FOR SELECT TO authenticated
USING (customer_id = auth.uid());

CREATE POLICY "Riders can view ratings about their deliveries"
ON public.ratings FOR SELECT TO authenticated
USING (
  rider_id IS NOT NULL
  AND rider_id IN (SELECT public.get_rider_id_for_user(auth.uid()))
);

CREATE POLICY "Restaurant owners can view ratings for their orders"
ON public.ratings FOR SELECT TO authenticated
USING (
  order_id IN (
    SELECT o.id FROM public.orders o
    JOIN public.restaurants r ON r.id = o.restaurant_id
    WHERE r.owner_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all ratings"
ON public.ratings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
