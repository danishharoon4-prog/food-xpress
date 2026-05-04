
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS owner_id uuid,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS rejection_reason text;

CREATE INDEX IF NOT EXISTS idx_restaurants_owner ON public.restaurants(owner_id);

ALTER TABLE public.ratings
  ADD COLUMN IF NOT EXISTS restaurant_id uuid,
  ADD COLUMN IF NOT EXISTS restaurant_rating integer;

CREATE OR REPLACE FUNCTION public.get_owned_restaurant_id(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.restaurants WHERE owner_id = _user_id
$$;

DROP POLICY IF EXISTS "Anyone can view active restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Anyone can view approved active restaurants" ON public.restaurants;
CREATE POLICY "Anyone can view approved active restaurants"
ON public.restaurants FOR SELECT
USING (is_active = true AND approval_status = 'approved');

DROP POLICY IF EXISTS "Owners can view own restaurant" ON public.restaurants;
CREATE POLICY "Owners can view own restaurant"
ON public.restaurants FOR SELECT
USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners can update own restaurant" ON public.restaurants;
CREATE POLICY "Owners can update own restaurant"
ON public.restaurants FOR UPDATE
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Restaurant role can create own restaurant" ON public.restaurants;
CREATE POLICY "Restaurant role can create own restaurant"
ON public.restaurants FOR INSERT
WITH CHECK (owner_id = auth.uid() AND public.has_role(auth.uid(), 'restaurant'::app_role));

DROP POLICY IF EXISTS "Owners can manage own menu categories" ON public.menu_categories;
CREATE POLICY "Owners can manage own menu categories"
ON public.menu_categories FOR ALL
USING (restaurant_id IN (SELECT public.get_owned_restaurant_id(auth.uid())))
WITH CHECK (restaurant_id IN (SELECT public.get_owned_restaurant_id(auth.uid())));

DROP POLICY IF EXISTS "Owners can manage own menu items" ON public.menu_items;
CREATE POLICY "Owners can manage own menu items"
ON public.menu_items FOR ALL
USING (restaurant_id IN (SELECT public.get_owned_restaurant_id(auth.uid())))
WITH CHECK (restaurant_id IN (SELECT public.get_owned_restaurant_id(auth.uid())));

DROP POLICY IF EXISTS "Owners can view own restaurant orders" ON public.orders;
CREATE POLICY "Owners can view own restaurant orders"
ON public.orders FOR SELECT TO authenticated
USING (restaurant_id IN (SELECT public.get_owned_restaurant_id(auth.uid())));

DROP POLICY IF EXISTS "Owners can update own restaurant orders" ON public.orders;
CREATE POLICY "Owners can update own restaurant orders"
ON public.orders FOR UPDATE TO authenticated
USING (restaurant_id IN (SELECT public.get_owned_restaurant_id(auth.uid())))
WITH CHECK (restaurant_id IN (SELECT public.get_owned_restaurant_id(auth.uid())));

DROP POLICY IF EXISTS "Owners can view own restaurant order items" ON public.order_items;
CREATE POLICY "Owners can view own restaurant order items"
ON public.order_items FOR SELECT
USING (order_id IN (
  SELECT id FROM public.orders WHERE restaurant_id IN (SELECT public.get_owned_restaurant_id(auth.uid()))
));

CREATE OR REPLACE FUNCTION public.approve_restaurant(_restaurant_id uuid, _approve boolean, _reason text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _name text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.restaurants
  SET approval_status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
      rejection_reason = CASE WHEN _approve THEN NULL ELSE _reason END,
      is_active = CASE WHEN _approve THEN true ELSE is_active END,
      updated_at = now()
  WHERE id = _restaurant_id
  RETURNING owner_id, name INTO _owner, _name;

  IF _owner IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, data)
    VALUES (
      _owner,
      CASE WHEN _approve THEN 'Restaurant Approved' ELSE 'Restaurant Rejected' END,
      CASE WHEN _approve
        THEN 'Your restaurant "' || _name || '" has been approved and is now live.'
        ELSE 'Your restaurant "' || _name || '" was rejected. Reason: ' || COALESCE(_reason,'N/A')
      END,
      CASE WHEN _approve THEN 'success' ELSE 'warning' END,
      jsonb_build_object('restaurant_id', _restaurant_id)
    );
  END IF;

  RETURN true;
END;
$$;
