
-- Fix farmer-media bucket: ensure it's private
UPDATE storage.buckets SET public = false WHERE id = 'farmer-media';

-- Drop any overly permissive SELECT policy on farmer-media
DROP POLICY IF EXISTS "Anyone can view farmer media" ON storage.objects;
DROP POLICY IF EXISTS "Public can view farmer media" ON storage.objects;

-- Ensure authenticated-only SELECT on farmer-media
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage' 
    AND policyname = 'Authenticated users can view farmer media'
  ) THEN
    CREATE POLICY "Authenticated users can view farmer media"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'farmer-media');
  END IF;
END $$;

-- Fix supplier-logos: restrict listing to authenticated users only
DROP POLICY IF EXISTS "Anyone can view supplier logos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view supplier logos" ON storage.objects;

-- Recreate SELECT policy for supplier-logos scoped to authenticated
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage' 
    AND policyname = 'Authenticated users can view supplier logos'
  ) THEN
    CREATE POLICY "Authenticated users can view supplier logos"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'supplier-logos');
  END IF;
END $$;
