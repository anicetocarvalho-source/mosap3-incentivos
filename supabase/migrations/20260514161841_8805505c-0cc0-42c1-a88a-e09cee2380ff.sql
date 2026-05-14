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
  v_total_patec_1 int := 0;
  v_total_patec_2 int := 0;
  v_total_patec_3 int := 0;
  v_total_sem_patec int := 0;
  v_has_period boolean := (p_from IS NOT NULL AND p_to IS NOT NULL);
BEGIN
  WITH scoped AS (
    SELECT code, status, valor_recebido, total_gasto, school, municipality, gender, patec, created_at
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
    count(DISTINCT NULLIF(school, '')),
    count(DISTINCT NULLIF(municipality, '')),
    count(*) FILTER (WHERE patec = 1),
    count(*) FILTER (WHERE patec = 2),
    count(*) FILTER (WHERE patec = 3),
    count(*) FILTER (WHERE patec IS NULL)
  INTO v_total_farmers, v_total_approved, v_total_female, v_female_with_incentive,
       v_total_no_gender, v_total_schools, v_total_municipalities,
       v_total_patec_1, v_total_patec_2, v_total_patec_3, v_total_sem_patec
  FROM scoped;

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
    'total_patec_1', v_total_patec_1,
    'total_patec_2', v_total_patec_2,
    'total_patec_3', v_total_patec_3,
    'total_sem_patec', v_total_sem_patec
  );

  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.dashboard_charts(p_scope text, p_provinces text[] DEFAULT '{}'::text[], p_ecas text[] DEFAULT '{}'::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_farmers_by_province jsonb;
  v_gender_data jsonb;
  v_tx_by_province jsonb;
  v_production_by_culture jsonb;
  v_livestock_by_species jsonb;
  v_pos_sales_trend jsonb;
  v_male int := 0;
  v_female int := 0;
  v_total_g int := 0;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', name, 'value', value) ORDER BY value DESC), '[]'::jsonb)
  INTO v_farmers_by_province
  FROM (
    SELECT province AS name, count(*)::int AS value
    FROM farmers
    WHERE province IS NOT NULL AND province <> ''
      AND (p_scope = 'global'
           OR (p_scope = 'province' AND province = ANY(p_provinces))
           OR (p_scope = 'eca'      AND school   = ANY(p_ecas)))
    GROUP BY province
  ) s;

  SELECT
    count(*) FILTER (WHERE gender = 'Masculino'),
    count(*) FILTER (WHERE gender = 'Feminino')
  INTO v_male, v_female
  FROM farmers
  WHERE (p_scope = 'global'
     OR (p_scope = 'province' AND province = ANY(p_provinces))
     OR (p_scope = 'eca'      AND school   = ANY(p_ecas)));
  v_total_g := GREATEST(v_male + v_female, 1);
  v_gender_data := jsonb_build_array(
    jsonb_build_object('name', 'Masculino', 'value', round((v_male::numeric / v_total_g * 1000))/10, 'color', 'hsl(65, 70%, 40%)'),
    jsonb_build_object('name', 'Feminino',  'value', round((v_female::numeric / v_total_g * 1000))/10, 'color', 'hsl(0, 60%, 55%)')
  );

  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', name, 'value', value) ORDER BY value DESC), '[]'::jsonb)
  INTO v_tx_by_province
  FROM (
    SELECT COALESCE(f.province, 'Outro') AS name, count(*)::int AS value
    FROM farmer_transactions t
    LEFT JOIN farmers f ON f.code = t.farmer_code
    WHERE (p_scope = 'global'
       OR (p_scope = 'province' AND f.province = ANY(p_provinces))
       OR (p_scope = 'eca'      AND f.school   = ANY(p_ecas)))
    GROUP BY COALESCE(f.province, 'Outro')
  ) s;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'name', name,
    'area', round(area::numeric, 1),
    'producao', round(producao::numeric, 1)
  ) ORDER BY producao DESC), '[]'::jsonb)
  INTO v_production_by_culture
  FROM (
    SELECT
      pr.culture AS name,
      sum(parse_ptao_numeric(pr.area)) AS area,
      sum(parse_ptao_numeric(pr.actual_yield)) AS producao
    FROM farmer_production pr
    WHERE EXISTS (SELECT 1 FROM farmers f WHERE f.code = pr.farmer_code
                  AND (p_scope = 'global'
                    OR (p_scope = 'province' AND f.province = ANY(p_provinces))
                    OR (p_scope = 'eca'      AND f.school   = ANY(p_ecas))))
    GROUP BY pr.culture
  ) s;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'name', name,
    'quantidade', quantidade,
    'produtores', produtores
  ) ORDER BY quantidade DESC), '[]'::jsonb)
  INTO v_livestock_by_species
  FROM (
    SELECT
      l.species AS name,
      sum(l.quantity)::int AS quantidade,
      count(DISTINCT l.farmer_id)::int AS produtores
    FROM livestock l
    WHERE EXISTS (SELECT 1 FROM farmers f WHERE f.code = l.farmer_id
                  AND (p_scope = 'global'
                    OR (p_scope = 'province' AND f.province = ANY(p_provinces))
                    OR (p_scope = 'eca'      AND f.school   = ANY(p_ecas))))
    GROUP BY l.species
  ) s;

  WITH months AS (
    SELECT generate_series(
      date_trunc('month', now()) - interval '11 months',
      date_trunc('month', now()),
      interval '1 month'
    )::date AS m
  ),
  agg AS (
    SELECT date_trunc('month', s.created_at)::date AS m,
           sum(s.total)::numeric AS valor,
           count(*)::int AS vendas
    FROM pos_sales s
    WHERE s.created_at >= date_trunc('month', now()) - interval '11 months'
      AND (p_scope = 'global'
           OR EXISTS (SELECT 1 FROM farmers f WHERE f.code = s.farmer_code
                      AND ((p_scope = 'province' AND f.province = ANY(p_provinces))
                        OR (p_scope = 'eca'      AND f.school   = ANY(p_ecas)))))
    GROUP BY 1
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'month', to_char(months.m, 'TMMon'),
    'valor', round(COALESCE(agg.valor, 0)::numeric),
    'vendas', COALESCE(agg.vendas, 0)
  ) ORDER BY months.m), '[]'::jsonb)
  INTO v_pos_sales_trend
  FROM months
  LEFT JOIN agg ON agg.m = months.m;

  RETURN jsonb_build_object(
    'farmers_by_province', v_farmers_by_province,
    'gender_data', v_gender_data,
    'transactions_by_province', v_tx_by_province,
    'production_by_culture', v_production_by_culture,
    'livestock_by_species', v_livestock_by_species,
    'pos_sales_trend', v_pos_sales_trend
  );
END;
$function$;