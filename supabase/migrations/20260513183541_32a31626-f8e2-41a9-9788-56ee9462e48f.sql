-- 1. Tabela de resoluções de anomalias
CREATE TABLE public.anomaly_resolutions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  anomaly_type TEXT NOT NULL,
  anomaly_key TEXT NOT NULL,
  resolved_as TEXT NOT NULL DEFAULT 'falso_positivo',
  notes TEXT,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (anomaly_type, anomaly_key)
);

CREATE INDEX idx_anomaly_resolutions_key ON public.anomaly_resolutions (anomaly_type, anomaly_key);

ALTER TABLE public.anomaly_resolutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and incentive managers can view anomaly resolutions"
ON public.anomaly_resolutions FOR SELECT TO authenticated
USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'gestor_incentivos'::app_role));

CREATE POLICY "Admins and incentive managers can insert anomaly resolutions"
ON public.anomaly_resolutions FOR INSERT TO authenticated
WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'gestor_incentivos'::app_role));

CREATE POLICY "Admins and incentive managers can update anomaly resolutions"
ON public.anomaly_resolutions FOR UPDATE TO authenticated
USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'gestor_incentivos'::app_role));

CREATE POLICY "Admins can delete anomaly resolutions"
ON public.anomaly_resolutions FOR DELETE TO authenticated
USING (is_admin(auth.uid()));

-- 2. Helper: normaliza nomes (lowercase, sem acentos, sem espaços extra)
CREATE OR REPLACE FUNCTION public.normalize_name(_s text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(regexp_replace(
    translate(
      coalesce(_s, ''),
      'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç',
      'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'
    ),
    '\s+', ' ', 'g'
  ));
$$;

-- 3. Função principal: detect_farmer_anomalies
CREATE OR REPLACE FUNCTION public.detect_farmer_anomalies(
  p_scope text DEFAULT 'global',
  p_provinces text[] DEFAULT '{}',
  p_ecas text[] DEFAULT '{}',
  p_include_resolved boolean DEFAULT false
)
RETURNS TABLE(
  anomaly_type text,
  severity text,
  anomaly_key text,
  farmer_code text,
  farmer_name text,
  province text,
  municipality text,
  school text,
  details jsonb,
  related_codes text[],
  resolved boolean,
  resolved_notes text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH scoped AS (
    SELECT f.code, f.full_name, f.province, f.municipality, f.school,
           f.phone, f.bi, f.valor_recebido, f.total_gasto, f.gender, f.patec
    FROM farmers f
    WHERE COALESCE(f.status,'') <> 'Removido'
      AND (p_scope = 'global'
        OR (p_scope = 'province' AND f.province = ANY(p_provinces))
        OR (p_scope = 'eca'      AND f.school   = ANY(p_ecas)))
  ),
  -- Duplicados por nome normalizado + província + município
  dup_groups AS (
    SELECT
      normalize_name(full_name) AS norm_name,
      province, municipality,
      array_agg(code ORDER BY code) AS codes,
      array_agg(full_name ORDER BY code) AS names,
      count(*) AS n
    FROM scoped
    WHERE full_name IS NOT NULL AND full_name <> ''
      AND province IS NOT NULL AND municipality IS NOT NULL
    GROUP BY normalize_name(full_name), province, municipality
    HAVING count(*) > 1
  ),
  dup_anom AS (
    SELECT
      'duplicado'::text AS anomaly_type,
      'alta'::text AS severity,
      'duplicado:' || dg.norm_name || '|' || dg.province || '|' || dg.municipality AS anomaly_key,
      s.code AS farmer_code,
      s.full_name AS farmer_name,
      s.province, s.municipality, s.school,
      jsonb_build_object(
        'reason', 'Mesmo nome na mesma província/município',
        'group_size', dg.n,
        'group_names', dg.names
      ) AS details,
      dg.codes AS related_codes
    FROM dup_groups dg
    JOIN scoped s ON normalize_name(s.full_name) = dg.norm_name
                 AND s.province = dg.province
                 AND s.municipality = dg.municipality
  ),
  -- Saldo negativo
  neg_anom AS (
    SELECT
      'saldo_negativo'::text AS anomaly_type,
      'alta'::text AS severity,
      'saldo_negativo:' || s.code AS anomaly_key,
      s.code AS farmer_code,
      s.full_name AS farmer_name,
      s.province, s.municipality, s.school,
      jsonb_build_object(
        'recebido', parse_ptao_numeric(s.valor_recebido),
        'gasto', parse_ptao_numeric(s.total_gasto),
        'saldo', parse_ptao_numeric(s.valor_recebido) - parse_ptao_numeric(s.total_gasto)
      ) AS details,
      ARRAY[s.code] AS related_codes
    FROM scoped s
    WHERE parse_ptao_numeric(s.total_gasto) > parse_ptao_numeric(s.valor_recebido)
      AND parse_ptao_numeric(s.total_gasto) > 0
  ),
  -- Valor fora dos escalões {0, 200000, 301760, 915840}
  off_anom AS (
    SELECT
      'valor_fora_escalao'::text AS anomaly_type,
      'media'::text AS severity,
      'valor_fora_escalao:' || s.code AS anomaly_key,
      s.code AS farmer_code,
      s.full_name AS farmer_name,
      s.province, s.municipality, s.school,
      jsonb_build_object(
        'recebido', parse_ptao_numeric(s.valor_recebido),
        'recebido_raw', s.valor_recebido,
        'expected_tiers', ARRAY[200000, 301760, 915840]
      ) AS details,
      ARRAY[s.code] AS related_codes
    FROM scoped s
    WHERE parse_ptao_numeric(s.valor_recebido) > 0
      AND parse_ptao_numeric(s.valor_recebido) NOT IN (200000, 301760, 915840)
  ),
  -- Telefones partilhados
  phone_groups AS (
    SELECT s.phone, array_agg(s.code ORDER BY s.code) AS codes,
           array_agg(s.full_name ORDER BY s.code) AS names, count(*) AS n
    FROM scoped s
    WHERE s.phone IS NOT NULL AND btrim(s.phone) <> ''
    GROUP BY s.phone HAVING count(*) > 1
  ),
  phone_anom AS (
    SELECT
      'telefone_partilhado'::text AS anomaly_type,
      'alta'::text AS severity,
      'telefone_partilhado:' || pg.phone AS anomaly_key,
      s.code AS farmer_code,
      s.full_name AS farmer_name,
      s.province, s.municipality, s.school,
      jsonb_build_object(
        'phone', pg.phone,
        'group_size', pg.n,
        'group_names', pg.names
      ) AS details,
      pg.codes AS related_codes
    FROM phone_groups pg
    JOIN scoped s ON s.phone = pg.phone
  ),
  -- BIs partilhados
  bi_groups AS (
    SELECT s.bi, array_agg(s.code ORDER BY s.code) AS codes,
           array_agg(s.full_name ORDER BY s.code) AS names, count(*) AS n
    FROM scoped s
    WHERE s.bi IS NOT NULL AND btrim(s.bi) <> ''
    GROUP BY s.bi HAVING count(*) > 1
  ),
  bi_anom AS (
    SELECT
      'bi_partilhado'::text AS anomaly_type,
      'alta'::text AS severity,
      'bi_partilhado:' || bg.bi AS anomaly_key,
      s.code AS farmer_code,
      s.full_name AS farmer_name,
      s.province, s.municipality, s.school,
      jsonb_build_object(
        'bi', bg.bi,
        'group_size', bg.n,
        'group_names', bg.names
      ) AS details,
      bg.codes AS related_codes
    FROM bi_groups bg
    JOIN scoped s ON s.bi = bg.bi
  ),
  all_anom AS (
    SELECT * FROM dup_anom
    UNION ALL SELECT * FROM neg_anom
    UNION ALL SELECT * FROM off_anom
    UNION ALL SELECT * FROM phone_anom
    UNION ALL SELECT * FROM bi_anom
  )
  SELECT
    a.anomaly_type,
    a.severity,
    a.anomaly_key,
    a.farmer_code,
    a.farmer_name,
    a.province,
    a.municipality,
    a.school,
    a.details,
    a.related_codes,
    (r.id IS NOT NULL) AS resolved,
    r.notes AS resolved_notes
  FROM all_anom a
  LEFT JOIN anomaly_resolutions r
    ON r.anomaly_type = a.anomaly_type AND r.anomaly_key = a.anomaly_key
  WHERE p_include_resolved OR r.id IS NULL
  ORDER BY a.anomaly_type, a.farmer_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.detect_farmer_anomalies(text, text[], text[], boolean) TO authenticated;