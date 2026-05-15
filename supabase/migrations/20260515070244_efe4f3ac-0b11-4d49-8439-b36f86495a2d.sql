CREATE OR REPLACE FUNCTION public.dashboard_kpis(p_scope text, p_provinces text[] DEFAULT '{}'::text[], p_ecas text[] DEFAULT '{}'::text[], p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  v_total_farmers int := 0;
  v_total_approved int := 0;
  v_total_companies int := 0;
  v_total_companies_active int := 0;
  v_total_schools int := 0;
  v_total_municipalities int := 0;
  v_total_parcels int := 0;
  v_total_area_ha numeric := 0;
  v_total_production numeric := 0;
  v_total_livestock int := 0;
  v_total_livestock_producers int := 0;
  v_total_recebido numeric := 0;
  v_total_gasto numeric := 0;
  v_total_yield_kg numeric := 0;
  v_total_area_prod numeric := 0;
  v_critical_stock int := 0;
  v_total_transactions int := 0;
  v_volume_transactions numeric := 0;
  v_total_female int := 0;
  v_female_with_incentive int := 0;
  v_total_no_gender int := 0;
  v_total_incentives_count int := 0;
  v_total_credit_notes int := 0;
  v_patec_counts jsonb := '{}'::jsonb;
  v_total_sem_patec int := 0;
  v_total_patec_1 int := 0;
  v_total_patec_2 int := 0;
  v_total_patec_3 int := 0;
  v_has_period boolean := (p_from IS NOT NULL AND p_to IS NOT NULL);
BEGIN
  -- 1) Métricas básicas dos agricultores (sem PATEC)
  WITH scoped AS (
    SELECT code, status, valor_recebido, total_gasto, school, municipality, gender, patec, patec_code, created_at
    FROM farmers
    WHERE (p_scope = 'global'
        OR (p_scope = 'province' AND province = ANY(p_provinces))
        OR (p_scope = 'eca'      AND school   = ANY(p_ecas)))
      AND (NOT v_has_period OR (created_at::date BETWEEN p_from AND p_to))
  )
  SELECT
    count(*),
    count(*) FILTER (WHERE status = 'Aprovado'),
    count(*) FILTER (WHERE gender = 'Feminino'),
    count(*) FILTER (WHERE gender = 'Feminino' AND parse_ptao_numeric(valor_recebido) > 0),
    count(*) FILTER (WHERE gender IS NULL OR gender = ''),
    count(*) FILTER (WHERE patec_code IS NULL AND patec IS NULL)
  INTO v_total_farmers, v_total_approved, v_total_female, v_female_with_incentive,
       v_total_no_gender, v_total_sem_patec
  FROM scoped;

  -- 2) Contagem dinâmica por código de PATEC (usa patec_code; senão deriva de legacy_number)
  WITH scoped AS (
    SELECT f.patec, f.patec_code
    FROM farmers f
    WHERE (p_scope = 'global'
        OR (p_scope = 'province' AND f.province = ANY(p_provinces))
        OR (p_scope = 'eca'      AND f.school   = ANY(p_ecas)))
      AND (NOT v_has_period OR (f.created_at::date BETWEEN p_from AND p_to))
  ),
  resolved AS (
    SELECT
      COALESCE(
        s.patec_code,
        (SELECT p.code FROM patecs p WHERE p.legacy_number = s.patec LIMIT 1)
      ) AS code
    FROM scoped s
  ),
  agg AS (
    SELECT code, count(*)::int AS n
    FROM resolved
    WHERE code IS NOT NULL
    GROUP BY code
  )
  -- Garante que TODOS os pacotes existentes aparecem (com 0 quando não há agricultores)
  SELECT COALESCE(jsonb_object_agg(p.code, COALESCE(a.n, 0)), '{}'::jsonb)
  INTO v_patec_counts
  FROM patecs p
  LEFT JOIN agg a ON a.code = p.code;

  -- Compatibilidade: derivar total_patec_1/2/3 a partir do mapa via legacy_number
  SELECT COALESCE((v_patec_counts ->> code)::int, 0) INTO v_total_patec_1
    FROM patecs WHERE legacy_number = 1 LIMIT 1;
  SELECT COALESCE((v_patec_counts ->> code)::int, 0) INTO v_total_patec_2
    FROM patecs WHERE legacy_number = 2 LIMIT 1;
  SELECT COALESCE((v_patec_counts ->> code)::int, 0) INTO v_total_patec_3
    FROM patecs WHERE legacy_number = 3 LIMIT 1;

  -- 3) Escolas e municípios (oficiais)
  IF p_scope = 'global' THEN
    SELECT count(*) INTO v_total_schools FROM public.schools;
    SELECT count(*) INTO v_total_municipalities FROM public.municipalities;
  ELSIF p_scope = 'province' THEN
    SELECT count(*) INTO v_total_schools
      FROM public.schools s JOIN public.provinces p ON p.id = s.province_id
     WHERE p.name = ANY(p_provinces);
    SELECT count(*) INTO v_total_municipalities
      FROM public.municipalities m JOIN public.provinces p ON p.id = m.province_id
     WHERE p.name = ANY(p_provinces);
  ELSIF p_scope = 'eca' THEN
    SELECT count(*) INTO v_total_schools
      FROM public.schools WHERE name = ANY(p_ecas);
    SELECT count(DISTINCT s.municipality_id) INTO v_total_municipalities
      FROM public.schools s WHERE s.name = ANY(p_ecas);
  END IF;

  IF v_has_period THEN
    SELECT COALESCE(sum(parse_ptao_numeric(i.amount)), 0), count(*)
    INTO v_total_recebido, v_total_incentives_count
    FROM farmer_incentives i
    WHERE COALESCE(NULLIF(i.incentive_date,'')::date, i.created_at::date) BETWEEN p_from AND p_to
      AND EXISTS (SELECT 1 FROM farmers f WHERE f.code = i.farmer_code
                   AND (p_scope = 'global'
                     OR (p_scope = 'province' AND f.province = ANY(p_provinces))
                     OR (p_scope = 'eca'      AND f.school   = ANY(p_ecas))));

    SELECT COALESCE(sum(parse_ptao_numeric(t.valor)), 0)
    INTO v_total_gasto
    FROM farmer_transactions t
    WHERE COALESCE(NULLIF(t.transaction_date,'')::date, t.created_at::date) BETWEEN p_from AND p_to
      AND EXISTS (SELECT 1 FROM farmers f WHERE f.code = t.farmer_code
                   AND (p_scope = 'global'
                     OR (p_scope = 'province' AND f.province = ANY(p_provinces))
                     OR (p_scope = 'eca'      AND f.school   = ANY(p_ecas))));
  ELSE
    SELECT
      COALESCE(sum(parse_ptao_numeric(valor_recebido)), 0),
      COALESCE(sum(parse_ptao_numeric(total_gasto)), 0)
    INTO v_total_recebido, v_total_gasto
    FROM farmers
    WHERE (p_scope = 'global'
        OR (p_scope = 'province' AND province = ANY(p_provinces))
        OR (p_scope = 'eca'      AND school   = ANY(p_ecas)));

    SELECT count(*) INTO v_total_incentives_count
    FROM farmer_incentives i
    WHERE EXISTS (SELECT 1 FROM farmers f WHERE f.code = i.farmer_code
                   AND (p_scope = 'global'
                     OR (p_scope = 'province' AND f.province = ANY(p_provinces))
                     OR (p_scope = 'eca'      AND f.school   = ANY(p_ecas))));
  END IF;

  SELECT count(*), count(*) FILTER (WHERE status = 'Ativo')
  INTO v_total_companies, v_total_companies_active
  FROM suppliers;

  SELECT count(*) INTO v_total_credit_notes FROM credit_notes;

  SELECT count(*), COALESCE(sum(parse_ptao_numeric(area)), 0)
  INTO v_total_parcels, v_total_area_ha
  FROM farmer_parcels p
  WHERE EXISTS (SELECT 1 FROM farmers f WHERE f.code = p.farmer_code
                 AND (p_scope = 'global'
                   OR (p_scope = 'province' AND f.province = ANY(p_provinces))
                   OR (p_scope = 'eca'      AND f.school   = ANY(p_ecas))))
    AND (NOT v_has_period OR (p.created_at::date BETWEEN p_from AND p_to));

  SELECT
    COALESCE(sum(parse_ptao_numeric(actual_yield)), 0),
    COALESCE(sum(parse_ptao_numeric(actual_yield) * 1000), 0),
    COALESCE(sum(parse_ptao_numeric(area)), 0)
  INTO v_total_production, v_total_yield_kg, v_total_area_prod
  FROM farmer_production pr
  WHERE EXISTS (SELECT 1 FROM farmers f WHERE f.code = pr.farmer_code
                 AND (p_scope = 'global'
                   OR (p_scope = 'province' AND f.province = ANY(p_provinces))
                   OR (p_scope = 'eca'      AND f.school   = ANY(p_ecas))))
    AND (NOT v_has_period OR (COALESCE(NULLIF(pr.planted_date,'')::date, pr.created_at::date) BETWEEN p_from AND p_to));

  SELECT COALESCE(sum(quantity), 0), count(DISTINCT farmer_id)
  INTO v_total_livestock, v_total_livestock_producers
  FROM livestock l
  WHERE EXISTS (SELECT 1 FROM farmers f WHERE f.code = l.farmer_id
                 AND (p_scope = 'global'
                   OR (p_scope = 'province' AND f.province = ANY(p_provinces))
                   OR (p_scope = 'eca'      AND f.school   = ANY(p_ecas))))
    AND (NOT v_has_period OR (l.created_at::date BETWEEN p_from AND p_to));

  IF p_scope = 'global' THEN
    SELECT count(*) INTO v_critical_stock
    FROM supplier_products
    WHERE stock <= min_stock;
  END IF;

  SELECT count(*), COALESCE(sum(parse_ptao_numeric(valor)), 0)
  INTO v_total_transactions, v_volume_transactions
  FROM farmer_transactions t
  WHERE EXISTS (SELECT 1 FROM farmers f WHERE f.code = t.farmer_code
                 AND (p_scope = 'global'
                   OR (p_scope = 'province' AND f.province = ANY(p_provinces))
                   OR (p_scope = 'eca'      AND f.school   = ANY(p_ecas))))
    AND (NOT v_has_period OR (COALESCE(NULLIF(t.transaction_date,'')::date, t.created_at::date) BETWEEN p_from AND p_to));

  result := jsonb_build_object(
    'total_farmers', v_total_farmers,
    'total_approved', v_total_approved,
    'total_companies', v_total_companies,
    'total_companies_active', v_total_companies_active,
    'total_schools', v_total_schools,
    'total_municipalities', v_total_municipalities,
    'total_parcels', v_total_parcels,
    'total_area_ha', round(v_total_area_ha::numeric, 1),
    'total_production', round(v_total_production::numeric, 1),
    'total_livestock', v_total_livestock,
    'total_livestock_producers', v_total_livestock_producers,
    'total_recebido', v_total_recebido,
    'total_gasto', v_total_gasto,
    'utilization_rate', CASE WHEN v_total_recebido > 0
                             THEN round((v_total_gasto / v_total_recebido * 100)::numeric, 1)
                             ELSE 0 END,
    'avg_yield_per_ha', CASE WHEN v_total_area_prod > 0
                             THEN round((v_total_yield_kg / v_total_area_prod)::numeric)
                             ELSE 0 END,
    'critical_stock_count', v_critical_stock,
    'total_transactions', v_total_transactions,
    'volume_transactions', v_volume_transactions,
    'total_reconciliado', v_volume_transactions,
    'total_female', v_total_female,
    'female_with_incentive', v_female_with_incentive,
    'female_with_incentive_pct', CASE WHEN v_total_female > 0
                                      THEN round((v_female_with_incentive::numeric / v_total_female * 100)::numeric, 1)
                                      ELSE 0 END,
    'total_no_gender', v_total_no_gender,
    'total_incentives_count', v_total_incentives_count,
    'total_credit_notes', v_total_credit_notes,
    'patec_counts', v_patec_counts,
    'total_patec_1', v_total_patec_1,
    'total_patec_2', v_total_patec_2,
    'total_patec_3', v_total_patec_3,
    'total_sem_patec', v_total_sem_patec
  );

  RETURN result;
END;
$function$;