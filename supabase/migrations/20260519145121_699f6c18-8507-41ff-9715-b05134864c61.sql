
-- =====================================================================
-- Security hardening: tighten permissive RLS, lock down SECURITY DEFINER
-- function executions, move pg_trgm out of public, scope storage listing.
-- =====================================================================

-- 1) Permissive RLS policies ------------------------------------------------

-- farmer_fingerprints: was USING (true) for UPDATE
DROP POLICY IF EXISTS "Auth users can deactivate fingerprints" ON public.farmer_fingerprints;
CREATE POLICY "Backoffice can deactivate fingerprints"
ON public.farmer_fingerprints
FOR UPDATE
TO authenticated
USING (public.has_any_backoffice_role(auth.uid()))
WITH CHECK (public.has_any_backoffice_role(auth.uid()));

-- farmer_nfc_tags: was USING (true) for UPDATE
DROP POLICY IF EXISTS "Auth users can deactivate nfc tags" ON public.farmer_nfc_tags;
CREATE POLICY "Backoffice can deactivate nfc tags"
ON public.farmer_nfc_tags
FOR UPDATE
TO authenticated
USING (public.has_any_backoffice_role(auth.uid()))
WITH CHECK (public.has_any_backoffice_role(auth.uid()));

-- fingerprint_verifications: anon insert was WITH CHECK (true); require an
-- active device session, mirroring device_captures.
DROP POLICY IF EXISTS "Anon can log verifications" ON public.fingerprint_verifications;
CREATE POLICY "Anon can log verifications via valid session"
ON public.fingerprint_verifications
FOR INSERT
TO anon
WITH CHECK (
  device_session_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.device_sessions ds
    WHERE ds.id = fingerprint_verifications.device_session_id
      AND ds.status = ANY (ARRAY['paired'::text, 'active'::text])
      AND ds.expires_at > now()
  )
);

-- 2) Storage: stop listing of public 'supplier-logos' bucket ---------------
-- Public read of files via URL keeps working because the bucket is `public`.
DROP POLICY IF EXISTS "Authenticated users can view supplier logos" ON storage.objects;
CREATE POLICY "Backoffice can list supplier logos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'supplier-logos'::text
  AND public.has_any_backoffice_role(auth.uid())
);

-- 3) Move pg_trgm out of the public schema ---------------------------------
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- 4) Lock down SECURITY DEFINER functions ----------------------------------
-- Default: revoke EXECUTE from PUBLIC and anon for every SECURITY DEFINER
-- function in public, then re-grant to authenticated only for functions that
-- are explicitly invoked via RPC or referenced by RLS policies.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC',
                   r.proname, r.args);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon',
                   r.proname, r.args);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM authenticated',
                   r.proname, r.args);
  END LOOP;
END $$;

-- Whitelist: re-grant EXECUTE to authenticated for functions that the
-- frontend, edge functions, or RLS policies legitimately need.
DO $$
DECLARE
  fn text;
  whitelist text[] := ARRAY[
    -- RPC functions called from app code / edge functions
    'bulk_insert_orphan_phones',
    'credit_notes_kpis',
    'dashboard_charts',
    'dashboard_kpis',
    'dashboard_kpis_yoy',
    'dashboard_patec_counts',
    'detect_farmer_anomalies',
    'farmers_distinct_provinces',
    'farmers_sim_kpis',
    'generate_farmer_cards_batch',
    'is_admin',
    'list_backoffice_managers',
    'next_credit_note_number',
    'next_invoice_number',
    'notify_all_users',
    'notify_farmer_sim_blocked',
    'notify_users_by_role',
    'pos_sales_kpis',
    'recalc_farmer_totals',
    'transacoes_kpis',
    'invoice_years',
    -- Helpers used by RLS policies (must remain executable by authenticated)
    'has_role',
    'has_any_backoffice_role',
    'is_managing_eca',
    'is_managing_province',
    'is_patec_available'
  ];
  r record;
BEGIN
  FOREACH fn IN ARRAY whitelist LOOP
    FOR r IN
      SELECT p.oid, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn AND p.prosecdef = true
    LOOP
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated',
                     fn, r.args);
    END LOOP;
  END LOOP;
END $$;
