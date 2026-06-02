
CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  -- delivery pricing
  base_fare numeric NOT NULL DEFAULT 100,
  base_distance_km numeric NOT NULL DEFAULT 4,
  per_km_rate numeric NOT NULL DEFAULT 50,
  max_delivery_radius_km numeric NOT NULL DEFAULT 15,
  -- rider earnings
  rider_tier1_amount numeric NOT NULL DEFAULT 150,
  rider_tier1_max_km numeric NOT NULL DEFAULT 5,
  rider_tier2_amount numeric NOT NULL DEFAULT 400,
  -- payment methods
  cod_enabled boolean NOT NULL DEFAULT true,
  easypaisa_enabled boolean NOT NULL DEFAULT true,
  jazzcash_enabled boolean NOT NULL DEFAULT true,
  stripe_enabled boolean NOT NULL DEFAULT false,
  -- platform info
  platform_name text NOT NULL DEFAULT 'Food Xpress',
  support_phone text,
  support_email text,
  operating_city text NOT NULL DEFAULT 'Mansehra',
  opening_time time NOT NULL DEFAULT '09:00',
  closing_time time NOT NULL DEFAULT '23:00',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view platform settings"
  ON public.platform_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can update platform settings"
  ON public.platform_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert platform settings"
  ON public.platform_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_platform_settings_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.platform_settings (singleton) VALUES (true);
