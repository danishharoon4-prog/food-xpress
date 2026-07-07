DROP POLICY IF EXISTS "Anyone can view available menu items" ON public.menu_items;

CREATE POLICY "View menu items for active approved restaurants"
ON public.menu_items
FOR SELECT
USING (
  (is_available = true AND EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = menu_items.restaurant_id
      AND r.is_active = true
      AND r.approval_status = 'approved'
  ))
  OR EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = menu_items.restaurant_id AND r.owner_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);