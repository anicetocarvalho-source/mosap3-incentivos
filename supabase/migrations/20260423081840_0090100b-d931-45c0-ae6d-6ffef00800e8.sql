DROP FUNCTION IF EXISTS public.test_parse_ptao_numeric();

CREATE FUNCTION public.test_parse_ptao_numeric()
RETURNS TABLE(label text, input_text text, expected numeric, got numeric, ok boolean)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  WITH cases(label, input_text, expected) AS (VALUES
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
    c.input_text,
    c.expected,
    public.parse_ptao_numeric(c.input_text) AS got,
    public.parse_ptao_numeric(c.input_text) = c.expected AS ok
  FROM cases c;
$$;