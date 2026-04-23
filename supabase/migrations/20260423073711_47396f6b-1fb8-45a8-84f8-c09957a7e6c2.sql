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
    saldo_final = CASE
      WHEN public.parse_ptao_numeric(f.valor_recebido) - COALESCE(t.gasto,0) < 0
      THEN '-' || to_char(abs(public.parse_ptao_numeric(f.valor_recebido) - COALESCE(t.gasto,0)), 'FM999G999G990D00')
      ELSE to_char(public.parse_ptao_numeric(f.valor_recebido) - COALESCE(t.gasto,0), 'FM999G999G990D00')
    END
  FROM (SELECT code FROM public.farmers) c
  LEFT JOIN t ON t.farmer_code = c.code
  WHERE f.code = c.code;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalc_farmer_totals(_farmer_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_gasto numeric := 0;
  v_recebido numeric := 0;
  v_saldo numeric := 0;
BEGIN
  IF _farmer_code IS NULL THEN RETURN; END IF;
  SELECT COALESCE(SUM(public.parse_ptao_numeric(valor)), 0) INTO v_gasto
    FROM public.farmer_transactions WHERE farmer_code = _farmer_code;
  SELECT public.parse_ptao_numeric(valor_recebido) INTO v_recebido
    FROM public.farmers WHERE code = _farmer_code;
  v_saldo := COALESCE(v_recebido,0) - v_gasto;
  UPDATE public.farmers SET
    total_gasto = to_char(v_gasto, 'FM999G999G990D00'),
    saldo_final = CASE WHEN v_saldo < 0
      THEN '-' || to_char(abs(v_saldo), 'FM999G999G990D00')
      ELSE to_char(v_saldo, 'FM999G999G990D00') END
  WHERE code = _farmer_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_recalc_on_farmer_recebido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_gasto numeric := 0;
  v_saldo numeric := 0;
BEGIN
  IF NEW.valor_recebido IS DISTINCT FROM OLD.valor_recebido THEN
    SELECT COALESCE(SUM(public.parse_ptao_numeric(valor)), 0) INTO v_gasto
      FROM public.farmer_transactions WHERE farmer_code = NEW.code;
    v_saldo := public.parse_ptao_numeric(NEW.valor_recebido) - v_gasto;
    NEW.saldo_final := CASE WHEN v_saldo < 0
      THEN '-' || to_char(abs(v_saldo), 'FM999G999G990D00')
      ELSE to_char(v_saldo, 'FM999G999G990D00') END;
    NEW.total_gasto := to_char(v_gasto, 'FM999G999G990D00');
  END IF;
  RETURN NEW;
END;
$$;

-- Re-recalcular tudo com a função corrigida
SELECT public.recalc_all_farmer_totals();