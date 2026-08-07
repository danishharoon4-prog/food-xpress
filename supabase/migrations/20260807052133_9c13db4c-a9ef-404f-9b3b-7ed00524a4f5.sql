DROP POLICY IF EXISTS "Anyone authenticated can view platform settings" ON public.platform_settings;

CREATE POLICY "Admins can view platform settings"
  ON public.platform_settings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.get_public_platform_settings()
RETURNS TABLE(
  platform_name text,
  support_phone text,
  support_email text,
  operating_city text,
  opening_time time without time zone,
  closing_time time without time zone,
  cod_enabled boolean,
  easypaisa_enabled boolean,
  jazzcash_enabled boolean,
  stripe_enabled boolean,
  notifications_sound_enabled boolean,
  notifications_toast_enabled boolean,
  notifications_push_enabled boolean,
  base_fare numeric,
  base_distance_km numeric,
  per_km_rate numeric,
  max_delivery_radius_km numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT platform_name, support_phone, support_email, operating_city,
         opening_time, closing_time,
         cod_enabled, easypaisa_enabled, jazzcash_enabled, stripe_enabled,
         notifications_sound_enabled, notifications_toast_enabled, notifications_push_enabled,
         base_fare, base_distance_km, per_km_rate, max_delivery_radius_km
  FROM public.platform_settings
  WHERE singleton = true
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_public_platform_settings() TO authenticated, anon;