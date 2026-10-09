-- Proof photos live in Supabase Storage, not in the database.
--
-- The bucket is public to read: a photo's address contains a random id, and
-- the API only hands that address to people allowed to see the check-in.
-- Uploads go straight from the browser, and only into a folder named after
-- the signed-in user's own id. There is no policy for changing or deleting,
-- so a proof can't be swapped out afterwards. The server deletes photos once
-- they are two days old (see src/cleanup.ts), using the service role key.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('proofs', 'proofs', true, 1048576, ARRAY['image/jpeg'])
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "proofs: upload to own folder" ON storage.objects;
CREATE POLICY "proofs: upload to own folder" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'proofs' AND (storage.foldername(name))[1] = auth.uid()::text);
