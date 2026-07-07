
DROP POLICY IF EXISTS "Anyone can view ratings" ON public.ratings;
CREATE POLICY "Anyone can view ratings" ON public.ratings
  FOR SELECT TO anon, authenticated
  USING (true);

GRANT SELECT ON public.ratings TO anon;
