
-- AVATARS bucket policies
DROP POLICY IF EXISTS "avatars_owner_all" ON storage.objects;
DROP POLICY IF EXISTS "avatars_admin_read" ON storage.objects;
DROP POLICY IF EXISTS "avatars_auth_read" ON storage.objects;

CREATE POLICY "avatars_owner_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars_auth_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_admin_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- RIDER DOCUMENTS bucket policies
DROP POLICY IF EXISTS "rider_docs_owner_all" ON storage.objects;
DROP POLICY IF EXISTS "rider_docs_admin_read" ON storage.objects;

CREATE POLICY "rider_docs_owner_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'rider-documents' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'rider-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "rider_docs_admin_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'rider-documents' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- SUPPORT ATTACHMENTS bucket policies
DROP POLICY IF EXISTS "support_attach_owner_all" ON storage.objects;
DROP POLICY IF EXISTS "support_attach_admin_all" ON storage.objects;

CREATE POLICY "support_attach_owner_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'support-attachments' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'support-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "support_attach_admin_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'support-attachments' AND public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (bucket_id = 'support-attachments' AND public.has_role(auth.uid(), 'admin'::public.app_role));
