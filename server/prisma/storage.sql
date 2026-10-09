-- Proof photos live in Supabase Storage, not in the database, and they are
-- private. The bucket can't be read by address: a photo can only be opened by
-- the person who uploaded it, or by an admin, and only while signed in.
--
-- Uploads go straight from the browser, and only into a folder named after
-- the signed-in user's own id. There is no policy for changing or deleting,
-- so a proof can't be swapped out afterwards. The server deletes photos once
-- they are two days old (see src/cleanup.ts), using the service role key.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('proofs', 'proofs', false, 1048576, ARRAY['image/jpeg'])
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Whether the signed-in person is an admin. The User table is closed to the
-- browser (see rls.sql), so this runs with its owner's rights to look.
CREATE OR REPLACE FUNCTION public.is_wintarc_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS (SELECT 1 FROM public."User" WHERE id = auth.uid()::text AND "isAdmin") $$;

DROP POLICY IF EXISTS "proofs: upload to own folder" ON storage.objects;
CREATE POLICY "proofs: upload to own folder" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "proofs: read own, or all as admin" ON storage.objects;
CREATE POLICY "proofs: read own, or all as admin" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'proofs'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_wintarc_admin())
);
