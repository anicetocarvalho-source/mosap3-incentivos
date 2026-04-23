CREATE OR REPLACE FUNCTION public.parse_ptao_numeric(_s text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  s text;
  neg boolean := false;
  digits text;
  decimals text := '';
  comma_pos int;
BEGIN
  IF _s IS NULL OR btrim(_s) = '' THEN RETURN 0; END IF;
  s := btrim(_s);
  IF left(s,1) = '-' THEN neg := true; s := substr(s,2); END IF;
  -- Se tem vírgula, parte decimal é depois da última vírgula
  comma_pos := position(',' in s);
  IF comma_pos > 0 THEN
    decimals := regexp_replace(substr(s, comma_pos+1), '[^0-9]', '', 'g');
    digits := regexp_replace(substr(s, 1, comma_pos-1), '[^0-9]', '', 'g');
  ELSE
    digits := regexp_replace(s, '[^0-9]', '', 'g');
  END IF;
  IF digits = '' THEN digits := '0'; END IF;
  IF decimals = '' THEN decimals := '0'; END IF;
  RETURN (CASE WHEN neg THEN -1 ELSE 1 END) * (digits || '.' || decimals)::numeric;
EXCEPTION WHEN OTHERS THEN RETURN 0;
END;
$$;

-- Reset campos partidos e re-recalcular
UPDATE public.farmers SET
  saldo_final = '0,00',
  total_gasto = '0,00'
WHERE saldo_final ~ '\..*\..*\.' OR total_gasto ~ '\..*\..*\.';

SELECT public.recalc_all_farmer_totals();