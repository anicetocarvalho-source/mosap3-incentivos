
-- farmer_fingerprints
DROP POLICY IF EXISTS "Auth users can view fingerprints" ON public.farmer_fingerprints;
CREATE POLICY "Backoffice can view fingerprints"
  ON public.farmer_fingerprints FOR SELECT TO authenticated
  USING (public.has_any_backoffice_role(auth.uid()));

-- device_sessions: remover SELECT/UPDATE anon largos; substituir por RPC
DROP POLICY IF EXISTS "Anon can find pending sessions by code" ON public.device_sessions;

CREATE OR REPLACE FUNCTION public.public_lookup_device_session(_code text)
RETURNS TABLE(
  id uuid, session_code text, device_type text, status text,
  farmer_code text, expires_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, session_code, device_type, status, farmer_code, expires_at
  FROM public.device_sessions
  WHERE session_code = _code
    AND status = ANY (ARRAY['pending','paired','active'])
    AND expires_at > now()
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.public_lookup_device_session(text) FROM public;
GRANT EXECUTE ON FUNCTION public.public_lookup_device_session(text) TO anon, authenticated;

-- Pareamento anon continua via UPDATE existente (qual mantém-se: status='pending' AND expires_at>now()).
-- Isto exige que a app companheira conheça o id da sessão; obtém-no via RPC acima.

-- supplier_products / supplier_provinces / season_limits: público → authenticated
DROP POLICY IF EXISTS "Auth users can view products" ON public.supplier_products;
CREATE POLICY "Authenticated can view products"
  ON public.supplier_products FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth users can view supplier_provinces" ON public.supplier_provinces;
CREATE POLICY "Authenticated can view supplier_provinces"
  ON public.supplier_provinces FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth users can view season limits" ON public.season_limits;
CREATE POLICY "Authenticated can view season limits"
  ON public.season_limits FOR SELECT TO authenticated USING (true);
