CREATE OR REPLACE FUNCTION public.recalc_all_farmer_totals()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH t AS (
    SELECT farmer_code, COALESCE(SUM(public.parse_ptao_numeric(valor)),0) AS gasto
    FROM public.farmer_transactions GROUP BY farmer_code
  )
  UPDATE public.farmers f SET
    total_gasto = to_char(COALESCE(t.gasto,0), 'FM999G999G990D00'),
    saldo_final = to_char(public.parse_ptao_numeric(f.valor_recebido) - COALESCE(t.gasto,0), 'FM999G999G990D00')
  FROM (SELECT code FROM public.farmers) c
  LEFT JOIN t ON t.farmer_code = c.code
  WHERE f.code = c.code;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;