DROP FUNCTION IF EXISTS public.detect_farmer_anomalies(text, text[], text[], boolean);

CREATE OR REPLACE FUNCTION public.detect_farmer_anomalies(
  p_scope text DEFAULT 'global',
  p_provinces text[] DEFAULT '{}',
  p_ecas text[] DEFAULT '{}',
  p_include_resolved boolean DEFAULT false
)
RETURNS TABLE(
  out_anomaly_type text,
  out_severity text,
  out_anomaly_key text,
  out_farmer_code text,
  out_farmer_name text,
  out_province text,
  out_municipality text,
  out_school text,
  out_details jsonb,
  out_related_codes text[],
  out_resolved boolean,
  out_resolved_notes text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH scoped AS (
    SELECT f.code, f.full_name, f.province, f.municipality, f.school,
           f.phone, f.bi, f.valor_recebido, f.total_gasto
    FROM farmers f
    WHERE COALESCE(f.status,'') <> 'Removido'
      AND (p_scope = 'global'
        OR (p_scope = 'province' AND f.province = ANY(p_provinces))
        OR (p_scope = 'eca'      AND f.school   = ANY(p_ecas)))
  ),
  dup_groups AS (
    SELECT
      normalize_name(s.full_name) AS norm_name,
      s.province AS prov, s.municipality AS muni,
      array_agg(s.code ORDER BY s.code) AS codes,
      array_agg(s.full_name ORDER BY s.code) AS names,
      count(*) AS n
    FROM scoped s
    WHERE s.full_name IS NOT NULL AND s.full_name <> ''
      AND s.province IS NOT NULL AND s.municipality IS NOT NULL
    GROUP BY normalize_name(s.full_name), s.province, s.municipality
    HAVING count(*) > 1
  ),
  dup_anom AS (
    SELECT
      'duplicado'::text AS atype,
      'alta'::text AS sev,
      'duplicado:' || dg.norm_name || '|' || dg.prov || '|' || dg.muni AS akey,
      s.code AS fcode, s.full_name AS fname,
      s.province AS prov, s.municipality AS muni, s.school AS sch,
      jsonb_build_object('reason','Mesmo nome na mesma província/município',
        'group_size', dg.n, 'group_names', dg.names) AS det,
      dg.codes AS rcodes
    FROM dup_groups dg
    JOIN scoped s ON normalize_name(s.full_name) = dg.norm_name
                 AND s.province = dg.prov AND s.municipality = dg.muni
  ),
  neg_anom AS (
    SELECT 'saldo_negativo'::text, 'alta'::text,
      'saldo_negativo:' || s.code,
      s.code, s.full_name, s.province, s.municipality, s.school,
      jsonb_build_object(
        'recebido', parse_ptao_numeric(s.valor_recebido),
        'gasto', parse_ptao_numeric(s.total_gasto),
        'saldo', parse_ptao_numeric(s.valor_recebido) - parse_ptao_numeric(s.total_gasto)
      ),
      ARRAY[s.code]
    FROM scoped s
    WHERE parse_ptao_numeric(s.total_gasto) > parse_ptao_numeric(s.valor_recebido)
      AND parse_ptao_numeric(s.total_gasto) > 0
  ),
  off_anom AS (
    SELECT 'valor_fora_escalao'::text, 'media'::text,
      'valor_fora_escalao:' || s.code,
      s.code, s.full_name, s.province, s.municipality, s.school,
      jsonb_build_object(
        'recebido', parse_ptao_numeric(s.valor_recebido),
        'recebido_raw', s.valor_recebido,
        'expected_tiers', ARRAY[200000, 301760, 915840]
      ),
      ARRAY[s.code]
    FROM scoped s
    WHERE parse_ptao_numeric(s.valor_recebido) > 0
      AND parse_ptao_numeric(s.valor_recebido) NOT IN (200000, 301760, 915840)
  ),
  phone_groups AS (
    SELECT s.phone AS ph, array_agg(s.code ORDER BY s.code) AS codes,
           array_agg(s.full_name ORDER BY s.code) AS names, count(*) AS n
    FROM scoped s
    WHERE s.phone IS NOT NULL AND btrim(s.phone) <> ''
    GROUP BY s.phone HAVING count(*) > 1
  ),
  phone_anom AS (
    SELECT 'telefone_partilhado'::text, 'alta'::text,
      'telefone_partilhado:' || pg.ph,
      s.code, s.full_name, s.province, s.municipality, s.school,
      jsonb_build_object('phone', pg.ph, 'group_size', pg.n, 'group_names', pg.names),
      pg.codes
    FROM phone_groups pg
    JOIN scoped s ON s.phone = pg.ph
  ),
  bi_groups AS (
    SELECT s.bi AS b, array_agg(s.code ORDER BY s.code) AS codes,
           array_agg(s.full_name ORDER BY s.code) AS names, count(*) AS n
    FROM scoped s
    WHERE s.bi IS NOT NULL AND btrim(s.bi) <> ''
    GROUP BY s.bi HAVING count(*) > 1
  ),
  bi_anom AS (
    SELECT 'bi_partilhado'::text, 'alta'::text,
      'bi_partilhado:' || bg.b,
      s.code, s.full_name, s.province, s.municipality, s.school,
      jsonb_build_object('bi', bg.b, 'group_size', bg.n, 'group_names', bg.names),
      bg.codes
    FROM bi_groups bg
    JOIN scoped s ON s.bi = bg.b
  ),
  all_anom AS (
    SELECT * FROM dup_anom
    UNION ALL SELECT * FROM neg_anom
    UNION ALL SELECT * FROM off_anom
    UNION ALL SELECT * FROM phone_anom
    UNION ALL SELECT * FROM bi_anom
  )
  SELECT
    a.atype, a.sev, a.akey, a.fcode, a.fname,
    a.prov, a.muni, a.sch, a.det, a.rcodes,
    (r.id IS NOT NULL) AS resolved,
    r.notes AS resolved_notes
  FROM all_anom a
  LEFT JOIN anomaly_resolutions r
    ON r.anomaly_type = a.atype AND r.anomaly_key = a.akey
  WHERE p_include_resolved OR r.id IS NULL
  ORDER BY a.atype, a.fcode;
END;
$$;

GRANT EXECUTE ON FUNCTION public.detect_farmer_anomalies(text, text[], text[], boolean) TO authenticated;