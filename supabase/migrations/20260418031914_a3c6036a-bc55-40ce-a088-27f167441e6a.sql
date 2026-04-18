-- 1. Add columns to riders
ALTER TABLE public.riders
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS license_number text,
  ADD COLUMN IF NOT EXISTS cnic_image_url text,
  ADD COLUMN IF NOT EXISTS vehicle_doc_url text,
  ADD COLUMN IF NOT EXISTS license_image_url text;

-- 2. Trigger: prevent unverified rider from going online
CREATE OR REPLACE FUNCTION public.enforce_rider_verified_online()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_online = true AND COALESCE(NEW.is_verified, false) = false THEN
    RAISE EXCEPTION 'Rider must be verified by admin before going online';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_rider_verified_online ON public.riders;
CREATE TRIGGER trg_enforce_rider_verified_online
BEFORE INSERT OR UPDATE OF is_online, is_verified ON public.riders
FOR EACH ROW EXECUTE FUNCTION public.enforce_rider_verified_online();

-- 3. Update claim_order to require verified
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
  SELECT r.id, p.city
    INTO _rider_id, _rider_city
  FROM public.riders r
  JOIN public.profiles p ON p.id = r.user_id
  WHERE r.user_id = auth.uid()
    AND r.is_online = true
    AND r.is_verified = true
  LIMIT 1;

  IF _rider_id IS NULL THEN
    RAISE EXCEPTION 'Rider not found, not online, or not verified';
  END IF;

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

-- 4. Tighten available-orders RLS to verified riders only
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
      AND riders.is_verified = true
  )
  AND restaurant_id IN (
    SELECT id FROM public.restaurants
    WHERE city IS NOT NULL AND city = public.get_current_rider_city()
  )
);

-- 5. RPC: rider updates ETA
CREATE OR REPLACE FUNCTION public.update_order_eta(_order_id uuid, _new_eta timestamptz)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rider_id uuid;
BEGIN
  SELECT id INTO _rider_id FROM public.riders WHERE user_id = auth.uid() LIMIT 1;
  IF _rider_id IS NULL THEN
    RAISE EXCEPTION 'Not a rider';
  END IF;

  UPDATE public.orders
  SET estimated_delivery_time = _new_eta,
      updated_at = now()
  WHERE id = _order_id
    AND rider_id = _rider_id
    AND status NOT IN ('delivered','cancelled');

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- 6. Storage bucket for rider documents (public read for simplicity)
INSERT INTO storage.buckets (id, name, public)
VALUES ('rider-documents', 'rider-documents', true)
ON CONFLICT (id) DO NOTHING;

-- 6a. Storage policies
DROP POLICY IF EXISTS "Public can view rider documents" ON storage.objects;
CREATE POLICY "Public can view rider documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'rider-documents');

DROP POLICY IF EXISTS "Riders can upload own documents" ON storage.objects;
CREATE POLICY "Riders can upload own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'rider-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Riders can update own documents" ON storage.objects;
CREATE POLICY "Riders can update own documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'rider-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Riders can delete own documents" ON storage.objects;
CREATE POLICY "Riders can delete own documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'rider-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 7. Realtime: ensure orders changes broadcast (idempotent)
ALTER TABLE public.orders REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.orders';
  END IF;
END $$;