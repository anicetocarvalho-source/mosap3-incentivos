
-- Fix 1: Make farmer-media bucket private
UPDATE storage.buckets SET public = false WHERE id = 'farmer-media';

-- Update SELECT policy to require authentication
DROP POLICY IF EXISTS "Anyone can view farmer media" ON storage.objects;
CREATE POLICY "Authenticated users can view farmer media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'farmer-media' AND auth.role() = 'authenticated');

-- Fix 2: Remove permissive INSERT policy on notifications
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
-- Notifications are now only insertable via SECURITY DEFINER triggers (on_farmer_created, etc.)
