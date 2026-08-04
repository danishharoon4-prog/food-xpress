
CREATE TABLE public.review_remarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('restaurant','rider')),
  target_id uuid NOT NULL,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_role text NOT NULL CHECK (author_role IN ('admin','owner')),
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_remarks TO authenticated;
GRANT ALL ON public.review_remarks TO service_role;

ALTER TABLE public.review_remarks ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_review_remarks_target ON public.review_remarks(target_type, target_id, created_at);

CREATE OR REPLACE FUNCTION public.can_access_review_target(_target_type text, _target_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _target_type = 'restaurant' THEN EXISTS (
      SELECT 1 FROM public.restaurants r WHERE r.id = _target_id AND r.owner_id = auth.uid()
    )
    WHEN _target_type = 'rider' THEN EXISTS (
      SELECT 1 FROM public.riders rd WHERE rd.id = _target_id AND rd.user_id = auth.uid()
    )
    ELSE false
  END
$$;

CREATE POLICY "Admins manage all review remarks"
ON public.review_remarks FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') AND author_id = auth.uid() AND author_role = 'admin');

CREATE POLICY "Owners view remarks on own profile"
ON public.review_remarks FOR SELECT TO authenticated
USING (public.can_access_review_target(target_type, target_id));

CREATE POLICY "Owners add remarks on own profile"
ON public.review_remarks FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND author_role = 'owner'
  AND public.can_access_review_target(target_type, target_id)
);

CREATE TRIGGER update_review_remarks_updated_at
BEFORE UPDATE ON public.review_remarks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Allow admins to start a support conversation for any user
CREATE POLICY "Admins create conversations for any user"
ON public.support_conversations FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));
