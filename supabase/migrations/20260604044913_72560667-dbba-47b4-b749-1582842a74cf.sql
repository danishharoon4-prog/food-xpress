
-- 1. Location change requests table
CREATE TABLE public.restaurant_location_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  requested_address text NOT NULL,
  requested_latitude numeric(10,8),
  requested_longitude numeric(11,8),
  reason text,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_location_change_requests TO authenticated;
GRANT ALL ON public.restaurant_location_change_requests TO service_role;

ALTER TABLE public.restaurant_location_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own requests"
ON public.restaurant_location_change_requests FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Owners create requests for own restaurant"
ON public.restaurant_location_change_requests FOR INSERT
WITH CHECK (
  requested_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
);

CREATE POLICY "Admins update requests"
ON public.restaurant_location_change_requests FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_loc_req_updated_at
BEFORE UPDATE ON public.restaurant_location_change_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Lock address edits by owner once approved
CREATE OR REPLACE FUNCTION public.enforce_restaurant_address_lock()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF OLD.approval_status = 'approved' AND (
    COALESCE(NEW.address, '') IS DISTINCT FROM COALESCE(OLD.address, '')
    OR COALESCE(NEW.latitude, 0) IS DISTINCT FROM COALESCE(OLD.latitude, 0)
    OR COALESCE(NEW.longitude, 0) IS DISTINCT FROM COALESCE(OLD.longitude, 0)
  ) THEN
    RAISE EXCEPTION 'Restaurant address is locked. Submit a location change request to admin.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_restaurant_address_lock
BEFORE UPDATE ON public.restaurants
FOR EACH ROW EXECUTE FUNCTION public.enforce_restaurant_address_lock();

-- 3. Admin applies a location change
CREATE OR REPLACE FUNCTION public.apply_restaurant_location_change(_request_id uuid, _approve boolean, _notes text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _req RECORD;
  _owner uuid;
  _name text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _req FROM public.restaurant_location_change_requests WHERE id = _request_id;
  IF _req.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF _req.status <> 'pending' THEN RAISE EXCEPTION 'Request already reviewed'; END IF;

  IF _approve THEN
    UPDATE public.restaurants
    SET address = _req.requested_address,
        latitude = _req.requested_latitude,
        longitude = _req.requested_longitude,
        updated_at = now()
    WHERE id = _req.restaurant_id
    RETURNING owner_id, name INTO _owner, _name;
  ELSE
    SELECT owner_id, name INTO _owner, _name FROM public.restaurants WHERE id = _req.restaurant_id;
  END IF;

  UPDATE public.restaurant_location_change_requests
  SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
      admin_notes = _notes,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  WHERE id = _request_id;

  IF _owner IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, data)
    VALUES (
      _owner,
      CASE WHEN _approve THEN 'Location updated' ELSE 'Location change rejected' END,
      CASE WHEN _approve
        THEN 'Your restaurant "' || _name || '" address has been updated by admin.'
        ELSE 'Your location change request for "' || _name || '" was rejected. ' || COALESCE(_notes, '')
      END,
      CASE WHEN _approve THEN 'success' ELSE 'warning' END,
      jsonb_build_object('restaurant_id', _req.restaurant_id, 'request_id', _request_id)
    );
  END IF;

  RETURN true;
END;
$$;
