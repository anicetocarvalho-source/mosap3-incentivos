-- Restrict system_settings: drop open SELECT, add admin-only for unitel keys, keep open for others
DROP POLICY IF EXISTS "Authenticated users can view settings" ON public.system_settings;

CREATE POLICY "Admins can view all settings"
  ON public.system_settings
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Non-admins can view non-sensitive settings"
  ON public.system_settings
  FOR SELECT
  TO authenticated
  USING (key NOT LIKE 'unitel_%');