
-- Create public bucket for supplier logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('supplier-logos', 'supplier-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to supplier-logos
CREATE POLICY "Auth users can upload supplier logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'supplier-logos');

-- Allow public read access
CREATE POLICY "Public can view supplier logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'supplier-logos');

-- Allow suppliers to delete their own logos
CREATE POLICY "Auth users can delete supplier logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'supplier-logos');

-- Allow suppliers to update their own logos
CREATE POLICY "Auth users can update supplier logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'supplier-logos');
