
-- 1) Formatador PT-AO independente de locale
CREATE OR REPLACE FUNCTION public.format_ptao_numeric(_v numeric)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  v numeric;
  neg boolean;
  int_part text;
  dec_part text;
  out_int text := '';
  i int;
  len int;
BEGIN
  IF _v IS NULL THEN RETURN '0,00'; END IF;
  v := round(_v, 2);
  neg := v < 0;
  v := abs(v);
  int_part := split_part(v::text, '.', 1);
  dec_part := COALESCE(NULLIF(split_part(v::text, '.', 2), ''), '0');
  IF length(dec_part) = 1 THEN dec_part := dec_part || '0'; END IF;
  IF length(dec_part) > 2 THEN dec_part := substr(dec_part, 1, 2); END IF;

  -- agrupar milhares com '.'
  len := length(int_part);
  FOR i IN 1..len LOOP
    IF i > 1 AND ((len - i + 1) % 3 = 0) THEN
      out_int := out_int || '.';
    END IF;
    out_int := out_int || substr(int_part, i, 1);
  END LOOP;

  RETURN CASE WHEN neg THEN '-' ELSE '' END || out_int || ',' || dec_part;
END;
$$;

-- 2) recalc_farmer_totals usar o novo formatador
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
    total_gasto = public.format_ptao_numeric(v_gasto),
    saldo_final = public.format_ptao_numeric(v_saldo)
  WHERE code = _farmer_code;
END;
$$;

-- 3) recalc_all_farmer_totals usar o novo formatador + normalizar valor_recebido
CREATE OR REPLACE FUNCTION public.recalc_all_farmer_totals()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_count integer;
BEGIN
  WITH t AS (
    SELECT farmer_code, COALESCE(SUM(public.parse_ptao_numeric(valor)),0) AS gasto
    FROM public.farmer_transactions GROUP BY farmer_code
  )
  UPDATE public.farmers f SET
    valor_recebido = public.format_ptao_numeric(public.parse_ptao_numeric(f.valor_recebido)),
    total_gasto    = public.format_ptao_numeric(COALESCE(t.gasto,0)),
    saldo_final    = public.format_ptao_numeric(public.parse_ptao_numeric(f.valor_recebido) - COALESCE(t.gasto,0))
  FROM (SELECT code FROM public.farmers) c
  LEFT JOIN t ON t.farmer_code = c.code
  WHERE f.code = c.code;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 4) Trigger no UPDATE de valor_recebido
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
    NEW.valor_recebido := public.format_ptao_numeric(public.parse_ptao_numeric(NEW.valor_recebido));
    NEW.saldo_final := public.format_ptao_numeric(v_saldo);
    NEW.total_gasto := public.format_ptao_numeric(v_gasto);
  END IF;
  RETURN NEW;
END;
$$;

-- 5) Aplicar a todos os 15.166 produtores
SELECT public.recalc_all_farmer_totals();
