CREATE OR REPLACE FUNCTION public.parse_ptao_numeric(_s text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _s IS NULL OR btrim(_s) = '' THEN 0
    ELSE COALESCE(NULLIF(replace(replace(_s, '.', ''), ',', '.'), '')::numeric, 0)
  END
$$;