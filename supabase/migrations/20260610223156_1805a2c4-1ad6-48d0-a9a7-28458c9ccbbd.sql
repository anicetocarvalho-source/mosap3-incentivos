
-- 1. Backup table: enable RLS + admin-only
ALTER TABLE public.patec_items_backup_20260609 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage patec_items_backup" ON public.patec_items_backup_20260609;
CREATE POLICY "Admins manage patec_items_backup"
  ON public.patec_items_backup_20260609
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 2. supplier_sellers: hide pin_hash / lockout columns from non-admin backoffice
REVOKE SELECT (pin_hash, failed_attempts, locked_until) ON public.supplier_sellers FROM authenticated;
-- service_role retains full access for edge functions (PIN verification)
GRANT SELECT (pin_hash, failed_attempts, locked_until) ON public.supplier_sellers TO service_role;
