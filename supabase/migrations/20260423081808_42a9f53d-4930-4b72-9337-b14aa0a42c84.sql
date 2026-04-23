-- 1) Parser robusto: auto-detecta PT-AO vs US
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
  cleaned text;
BEGIN
  IF _s IS NULL OR btrim(_s) = '' THEN RETURN 0; END IF;
  -- Mantém apenas dígitos, vírgulas, pontos e sinal de menos inicial
  s := btrim(_s);
  IF left(s,1) = '-' THEN
    neg := true;
    s := substr(s, 2);
  END IF;
  -- Remove tudo o que não seja dígito, vírgula ou ponto
  s := regexp_replace(s, '[^0-9.,]', '', 'g');
  IF s = '' THEN RETURN 0; END IF;

  last_comma := length(s) - position(',' in reverse(s)) + 1;
  IF position(',' in s) = 0 THEN last_comma := 0; END IF;
  last_dot := length(s) - position('.' in reverse(s)) + 1;
  IF position('.' in s) = 0 THEN last_dot := 0; END IF;

  IF last_comma = 0 AND last_dot = 0 THEN
    -- só dígitos
    digits := s;
  ELSIF last_comma > last_dot THEN
    -- PT-AO: vírgula é decimal, pontos são milhares
    decimals := regexp_replace(substr(s, last_comma + 1), '[^0-9]', '', 'g');
    digits   := regexp_replace(substr(s, 1, last_comma - 1), '[^0-9]', '', 'g');
  ELSE
    -- US: ponto é decimal, vírgulas são milhares
    decimals := regexp_replace(substr(s, last_dot + 1), '[^0-9]', '', 'g');
    digits   := regexp_replace(substr(s, 1, last_dot - 1), '[^0-9]', '', 'g');
  END IF;

  IF digits = '' THEN digits := '0'; END IF;
  IF decimals = '' THEN decimals := '0'; END IF;

  RETURN (CASE WHEN neg THEN -1 ELSE 1 END) * (digits || '.' || decimals)::numeric;
EXCEPTION WHEN OTHERS THEN RETURN 0;
END;
$function$;

-- 2) Função de auto-teste invocável a qualquer momento
CREATE OR REPLACE FUNCTION public.test_parse_ptao_numeric()
RETURNS TABLE(label text, input text, expected numeric, got numeric, ok boolean)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  failures int := 0;
BEGIN
  RETURN QUERY
  WITH cases(label, input, expected) AS (VALUES
    ('PT-AO inteiro',           '915.840',         915840::numeric),
    ('PT-AO com decimais',      '915.840,00',      915840.00::numeric),
    ('PT-AO milhar+dec',        '1.234.567,89',    1234567.89::numeric),
    ('PT-AO negativo',          '-915.840,00',     -915840.00::numeric),
    ('US inteiro',              '1234567',         1234567::numeric),
    ('US com decimais',         '1234567.89',      1234567.89::numeric),
    ('US com vírgula milhar',  '1,234,567.89',    1234567.89::numeric),
    ('Com Kz e espaços',       ' 50.000,00 Kz ',  50000.00::numeric),
    ('Vazio',                   '',                0::numeric),
    ('Espaços',                '   ',             0::numeric),
    ('Só decimais PT',         ',50',             0.50::numeric),
    ('Só decimais US',         '.50',             0.50::numeric),
    ('Zero',                    '0,00',            0::numeric),
    ('Pequeno',                 '5,75',            5.75::numeric),
    ('Unitel típico 200k',     '200.000,00',      200000.00::numeric),
    ('Unitel agg',              '915.840,00',      915840.00::numeric)
  )
  SELECT
    c.label,
    c.input,
    c.expected,
    public.parse_ptao_numeric(c.input) AS got,
    public.parse_ptao_numeric(c.input) = c.expected AS ok
  FROM cases c;

  SELECT count(*) INTO failures FROM (
    SELECT public.parse_ptao_numeric(input) = expected AS ok
    FROM (VALUES
      ('915.840', 915840::numeric),
      ('915.840,00', 915840.00::numeric),
      ('1.234.567,89', 1234567.89::numeric),
      ('-915.840,00', -915840.00::numeric),
      ('1234567', 1234567::numeric),
      ('1234567.89', 1234567.89::numeric),
      ('1,234,567.89', 1234567.89::numeric),
      (' 50.000,00 Kz ', 50000.00::numeric),
      ('', 0::numeric),
      ('   ', 0::numeric),
      (',50', 0.50::numeric),
      ('.50', 0.50::numeric),
      ('0,00', 0::numeric),
      ('5,75', 5.75::numeric),
      ('200.000,00', 200000.00::numeric),
      ('915.840,00', 915840.00::numeric)
    ) AS v(input, expected)
  ) x WHERE NOT ok;

  IF failures > 0 THEN
    RAISE EXCEPTION 'parse_ptao_numeric falhou em % caso(s) — abortar updates', failures;
  END IF;
END;
$$;