CREATE OR REPLACE FUNCTION public.parse_ptao_numeric(_s text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  s text;
  neg boolean := false;
  digits text;
  decimals text := '';
  last_comma int;
  last_dot int;
  parts text[];
  all_thousand_groups boolean;
  i int;
BEGIN
  IF _s IS NULL OR btrim(_s) = '' THEN RETURN 0; END IF;
  s := btrim(_s);
  IF left(s, 1) = '-' THEN neg := true; s := substr(s, 2); END IF;
  s := regexp_replace(s, '[^0-9.,]', '', 'g');
  IF s = '' THEN RETURN 0; END IF;

  last_comma := CASE WHEN position(',' in s) = 0 THEN 0
                     ELSE length(s) - position(',' in reverse(s)) + 1 END;
  last_dot := CASE WHEN position('.' in s) = 0 THEN 0
                   ELSE length(s) - position('.' in reverse(s)) + 1 END;

  IF last_comma = 0 AND last_dot = 0 THEN
    digits := s;
  ELSIF last_comma > last_dot THEN
    -- vírgula é o último separador → PT-AO
    decimals := regexp_replace(substr(s, last_comma + 1), '[^0-9]', '', 'g');
    digits   := regexp_replace(substr(s, 1, last_comma - 1), '[^0-9]', '', 'g');
  ELSIF last_comma = 0 AND last_dot > 0 THEN
    -- só pontos: heurística PT-AO se todos os grupos pós-primeiro têm 3 dígitos
    parts := string_to_array(s, '.');
    all_thousand_groups := true;
    FOR i IN 2 .. array_length(parts, 1) LOOP
      IF length(parts[i]) <> 3 THEN
        all_thousand_groups := false;
        EXIT;
      END IF;
    END LOOP;
    IF all_thousand_groups AND array_length(parts, 1) >= 2 THEN
      digits := array_to_string(parts, '');
    ELSE
      decimals := regexp_replace(substr(s, last_dot + 1), '[^0-9]', '', 'g');
      digits   := regexp_replace(substr(s, 1, last_dot - 1), '[^0-9]', '', 'g');
    END IF;
  ELSE
    -- ponto é o último separador → US
    decimals := regexp_replace(substr(s, last_dot + 1), '[^0-9]', '', 'g');
    digits   := regexp_replace(substr(s, 1, last_dot - 1), '[^0-9]', '', 'g');
  END IF;

  IF digits = '' THEN digits := '0'; END IF;
  IF decimals = '' THEN decimals := '0'; END IF;

  RETURN (CASE WHEN neg THEN -1 ELSE 1 END) * (digits || '.' || decimals)::numeric;
EXCEPTION WHEN OTHERS THEN RETURN 0;
END;
$function$;