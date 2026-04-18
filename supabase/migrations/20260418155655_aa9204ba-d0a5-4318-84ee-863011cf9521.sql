CREATE OR REPLACE FUNCTION public.parse_ptao_numeric(_s text)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _s IS NULL OR btrim(_s) = '' THEN 0
    ELSE COALESCE(
      NULLIF(
        regexp_replace(
          replace(replace(_s, '.', ''), ',', '.'),
          '[^0-9.\-]', '', 'g'
        ),
        ''
      )::numeric,
      0
    )
  END
$function$;