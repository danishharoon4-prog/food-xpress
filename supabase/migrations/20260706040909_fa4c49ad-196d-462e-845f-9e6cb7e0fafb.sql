
-- Remove any prior public/permissive policies on this bucket
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND (policyname ILIKE '%rider-documents%' OR policyname ILIKE '%rider_documents%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

-- Owner: rider can manage files inside their own folder (first path segment = auth.uid())
CREATE POLICY "rider-documents owner read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'rider-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "rider-documents owner insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'rider-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "rider-documents owner update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'rider-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'rider-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "rider-documents owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'rider-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Admins can read any rider document
CREATE POLICY "rider-documents admin read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'rider-documents'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);
