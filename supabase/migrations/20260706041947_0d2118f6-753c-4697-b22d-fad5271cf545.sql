
DROP POLICY IF EXISTS "System can insert initial role" ON public.user_roles;

CREATE POLICY "Users can self-assign customer role only"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND role = 'customer'::app_role
);
