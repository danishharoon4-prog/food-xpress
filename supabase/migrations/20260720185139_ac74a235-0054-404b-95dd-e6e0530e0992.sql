
-- 1. Admin audit log
CREATE TABLE public.admin_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_actor ON public.admin_audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.admin_audit_logs(action, created_at DESC);
CREATE INDEX idx_audit_logs_created ON public.admin_audit_logs(created_at DESC);

GRANT SELECT ON public.admin_audit_logs TO authenticated;
GRANT ALL ON public.admin_audit_logs TO service_role;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view audit logs"
ON public.admin_audit_logs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- No INSERT/UPDATE/DELETE policies — only SECURITY DEFINER functions can write.

-- 2. Login history
CREATE TABLE public.login_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  device_fingerprint TEXT,
  city TEXT,
  country TEXT,
  is_new_device BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_login_history_user ON public.login_history(user_id, created_at DESC);

GRANT SELECT ON public.login_history TO authenticated;
GRANT ALL ON public.login_history TO service_role;
ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own login history"
ON public.login_history FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all login history"
ON public.login_history FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Helper: log_admin_action
CREATE OR REPLACE FUNCTION public.log_admin_action(
  _action TEXT,
  _target_type TEXT DEFAULT NULL,
  _target_id TEXT DEFAULT NULL,
  _details JSONB DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _email TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.admin_audit_logs (actor_id, actor_email, action, target_type, target_id, details)
  VALUES (auth.uid(), _email, _action, _target_type, _target_id, COALESCE(_details, '{}'::jsonb));
END;
$$;

-- 4. Update existing admin RPCs to log
CREATE OR REPLACE FUNCTION public.admin_set_user_ban(_user_id uuid, _banned boolean, _reason text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot ban yourself';
  END IF;
  UPDATE public.profiles
  SET is_banned = _banned,
      banned_at = CASE WHEN _banned THEN now() ELSE NULL END,
      banned_reason = CASE WHEN _banned THEN _reason ELSE NULL END,
      updated_at = now()
  WHERE id = _user_id;

  PERFORM public.log_admin_action(
    CASE WHEN _banned THEN 'user.banned' ELSE 'user.unbanned' END,
    'user', _user_id::text,
    jsonb_build_object('reason', _reason)
  );
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_user_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role);

  PERFORM public.log_admin_action(
    'user.role_changed',
    'user', _user_id::text,
    jsonb_build_object('new_role', _role::text)
  );
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.approve_restaurant(_restaurant_id uuid, _approve boolean, _reason text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  PERFORM public.log_admin_action(
    CASE WHEN _approve THEN 'restaurant.approved' ELSE 'restaurant.rejected' END,
    'restaurant', _restaurant_id::text,
    jsonb_build_object('name', _name, 'reason', _reason)
  );
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.apply_restaurant_location_change(_request_id uuid, _approve boolean, _notes text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  PERFORM public.log_admin_action(
    CASE WHEN _approve THEN 'restaurant.location_approved' ELSE 'restaurant.location_rejected' END,
    'restaurant', _req.restaurant_id::text,
    jsonb_build_object('request_id', _request_id, 'notes', _notes)
  );
  RETURN true;
END;
$function$;

-- 5. RPC used by log-login edge function alternative — direct client insert
CREATE OR REPLACE FUNCTION public.record_login(
  _ip TEXT,
  _user_agent TEXT,
  _device_fingerprint TEXT,
  _city TEXT DEFAULT NULL,
  _country TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_new_device BOOLEAN := false;
  _seen_count INT;
  _order_short TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;

  SELECT COUNT(*) INTO _seen_count
  FROM public.login_history
  WHERE user_id = auth.uid()
    AND (device_fingerprint = _device_fingerprint OR ip_address = _ip)
    AND created_at > now() - interval '30 days';

  _is_new_device := (_seen_count = 0);

  INSERT INTO public.login_history (user_id, ip_address, user_agent, device_fingerprint, city, country, is_new_device)
  VALUES (auth.uid(), _ip, _user_agent, _device_fingerprint, _city, _country, _is_new_device);

  IF _is_new_device THEN
    INSERT INTO public.notifications (user_id, title, message, type, data)
    VALUES (
      auth.uid(),
      'New device signed in',
      'A new device or location just signed in to your account' ||
        CASE WHEN _city IS NOT NULL THEN ' from ' || _city ELSE '' END ||
        '. If this was not you, change your password immediately.',
      'warning',
      jsonb_build_object('ip', _ip, 'user_agent', _user_agent)
    );
  END IF;

  RETURN true;
END;
$$;
