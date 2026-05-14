
-- KPIs de pos_sales (filtrados por status e search)
CREATE OR REPLACE FUNCTION public.pos_sales_kpis(
  _status text DEFAULT NULL,
  _search text DEFAULT NULL,
  _invoice_only boolean DEFAULT false,
  _supplier_id uuid DEFAULT NULL,
  _year int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_count', COUNT(*),
    'total_revenue', COALESCE(SUM(total), 0),
    'total_subtotal', COALESCE(SUM(subtotal), 0),
    'total_iva', COALESCE(SUM(iva_total), 0),
    'paid_count', COUNT(*) FILTER (WHERE payment_status = 'pago'),
    'pending_count', COUNT(*) FILTER (WHERE payment_status = 'pendente'),
    'pending_total', COALESCE(SUM(total) FILTER (WHERE payment_status = 'pendente'), 0)
  )
  FROM pos_sales
  WHERE (_status IS NULL OR _status = 'all' OR payment_status = _status)
    AND (_invoice_only = false OR invoice_number IS NOT NULL)
    AND (_supplier_id IS NULL OR supplier_id = _supplier_id)
    AND (_year IS NULL OR EXTRACT(YEAR FROM created_at)::int = _year)
    AND (
      _search IS NULL OR _search = '' OR
      farmer_name ILIKE '%' || _search || '%' OR
      sale_code ILIKE '%' || _search || '%' OR
      farmer_code ILIKE '%' || _search || '%' OR
      COALESCE(invoice_number, '') ILIKE '%' || _search || '%'
    );
$$;

-- KPIs de credit_notes
CREATE OR REPLACE FUNCTION public.credit_notes_kpis(_search text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_count', COUNT(*),
    'total_credited', COALESCE(SUM(total), 0),
    'active_count', COUNT(*) FILTER (WHERE status = 'emitida')
  )
  FROM credit_notes
  WHERE (_search IS NULL OR _search = '' OR
         credit_note_number ILIKE '%' || _search || '%' OR
         farmer_name ILIKE '%' || _search || '%' OR
         farmer_code ILIKE '%' || _search || '%');
$$;

-- KPIs de SIM (contagem por status)
CREATE OR REPLACE FUNCTION public.farmers_sim_kpis()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'activo',          COUNT(*) FILTER (WHERE COALESCE(sim_status,'Desconhecido') = 'Activo'),
    'pre_desactivado', COUNT(*) FILTER (WHERE COALESCE(sim_status,'Desconhecido') = 'Pré desactivado'),
    'barrado',         COUNT(*) FILTER (WHERE COALESCE(sim_status,'Desconhecido') = 'Barrado'),
    'removido',        COUNT(*) FILTER (WHERE COALESCE(sim_status,'Desconhecido') = 'Removido'),
    'desconhecido',    COUNT(*) FILTER (WHERE COALESCE(sim_status,'Desconhecido') = 'Desconhecido')
  )
  FROM farmers
  WHERE status <> 'Removido';
$$;

-- Lista distinta de províncias (para dropdowns sem carregar 18k linhas)
CREATE OR REPLACE FUNCTION public.farmers_distinct_provinces()
RETURNS TABLE(province text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT province FROM farmers
  WHERE province IS NOT NULL AND province <> '' AND status <> 'Removido'
  ORDER BY province;
$$;

-- Anos distintos das facturas (para o filtro)
CREATE OR REPLACE FUNCTION public.invoice_years()
RETURNS TABLE(year int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT EXTRACT(YEAR FROM created_at)::int AS year
  FROM pos_sales
  WHERE invoice_number IS NOT NULL
  ORDER BY year DESC;
$$;

GRANT EXECUTE ON FUNCTION public.pos_sales_kpis(text, text, boolean, uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.credit_notes_kpis(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.farmers_sim_kpis() TO authenticated;
GRANT EXECUTE ON FUNCTION public.farmers_distinct_provinces() TO authenticated;
GRANT EXECUTE ON FUNCTION public.invoice_years() TO authenticated;
