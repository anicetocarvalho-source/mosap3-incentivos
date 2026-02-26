
-- Allow authenticated users to upload to farmer-media bucket (documents subfolder)
CREATE POLICY "Auth users can upload farmer documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'farmer-media');

CREATE POLICY "Auth users can read farmer documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'farmer-media');
