
-- Table to track uploaded APK releases
CREATE TABLE public.app_releases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  release_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_releases TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_releases TO authenticated;
GRANT ALL ON public.app_releases TO service_role;

ALTER TABLE public.app_releases ENABLE ROW LEVEL SECURITY;

-- Anyone can view active releases (needed for public download page)
CREATE POLICY "Anyone can view active releases"
ON public.app_releases FOR SELECT
USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert releases"
ON public.app_releases FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update releases"
ON public.app_releases FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete releases"
ON public.app_releases FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_app_releases_updated_at
BEFORE UPDATE ON public.app_releases
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies on app-releases bucket
CREATE POLICY "Admins can upload APKs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'app-releases' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update APKs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'app-releases' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete APKs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'app-releases' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read APKs directly"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'app-releases' AND public.has_role(auth.uid(), 'admin'));
