
-- Replace dashboard_kpis with optional period params
CREATE OR REPLACE FUNCTION public.dashboard_kpis(
  p_scope text,
  p_provinces text[] DEFAULT '{}'::text[],
  p_ecas text[] DEFAULT '{}'::text[],
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL
)
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
  v_total_schools int := 0;
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
  v_has_period boolean := (p_from IS NOT NULL AND p_to IS NOT NULL);
BEGIN
  -- Farmers (created_at as business date)
  WITH scoped AS (
    SELECT code, status, valor_recebido, total_gasto, school, gender, created_at
    FROM farmers
    WHERE
      (p_scope = 'global'
        OR (p_scope = 'province' AND province = ANY(p_provinces))
        OR (p_scope = 'eca'      AND school   = ANY(p_ecas)))
      AND (NOT v_has_period OR (created_at::date BETWEEN p_from AND p_to))
  )
  SELECT
    count(*),
    count(*) FILTER (WHERE status = 'Aprovado'),
    count(*) FILTER (WHERE gender = 'Feminino'),
    count(*) FILTER (WHERE gender = 'Feminino' AND parse_ptao_numeric(valor_recebido) > 0)
  INTO v_total_farmers, v_total_approved, v_total_female, v_female_with_incentive
  FROM scoped;

  -- valor_recebido / total_gasto: período usa fontes; sem período usa cumulativo do farmers
  IF v_has_period THEN
    SELECT COALESCE(sum(parse_ptao_numeric(i.amount)), 0)
    INTO v_total_recebido
    FROM farmer_incentives i
    WHERE COALESCE(NULLIF(i.incentive_date,'')::date, i.created_at::date) BETWEEN p_from AND p_to
      AND (p_scope = 'global'
        OR EXISTS (SELECT 1 FROM farmers f WHERE f.code = i.farmer_code
                   AND ((p_scope = 'province' AND f.province = ANY(p_provinces))
                     OR (p_scope = 'eca'      AND f.school   = ANY(p_ecas)))));

    SELECT COALESCE(sum(parse_ptao_numeric(t.valor)), 0)
    INTO v_total_gasto
    FROM farmer_transactions t
    WHERE COALESCE(NULLIF(t.transaction_date,'')::date, t.created_at::date) BETWEEN p_from AND p_to
      AND (p_scope = 'global'
        OR EXISTS (SELECT 1 FROM farmers f WHERE f.code = t.farmer_code
                   AND ((p_scope = 'province' AND f.province = ANY(p_provinces))
                     OR (p_scope = 'eca'      AND f.school   = ANY(p_ecas)))));
  ELSE
    SELECT
      COALESCE(sum(parse_ptao_numeric(valor_recebido)), 0),
      COALESCE(sum(parse_ptao_numeric(total_gasto)), 0)
    INTO v_total_recebido, v_total_gasto
    FROM farmers
    WHERE
      p_scope = 'global'
      OR (p_scope = 'province' AND province = ANY(p_provinces))
      OR (p_scope = 'eca'      AND school   = ANY(p_ecas));
  END IF;

  SELECT count(*) INTO v_total_companies FROM suppliers WHERE status = 'Ativo';

  IF p_scope = 'global' THEN
    SELECT count(*) INTO v_total_schools FROM schools;
  ELSIF p_scope = 'province' THEN
    SELECT count(DISTINCT school) INTO v_total_schools
    FROM farmers
    WHERE province = ANY(p_provinces) AND school IS NOT NULL AND school <> '';
  ELSE
    SELECT count(*) INTO v_total_schools FROM schools WHERE name = ANY(p_ecas);
  END IF;

  -- Parcels (created_at)
  SELECT count(*), COALESCE(sum(parse_ptao_numeric(area)), 0)
  INTO v_total_parcels, v_total_area_ha
  FROM farmer_parcels p
  WHERE
    (p_scope = 'global'
      OR EXISTS (SELECT 1 FROM farmers f WHERE f.code = p.farmer_code
                 AND ((p_scope = 'province' AND f.province = ANY(p_provinces))
                   OR (p_scope = 'eca'      AND f.school   = ANY(p_ecas)))))
    AND (NOT v_has_period OR (p.created_at::date BETWEEN p_from AND p_to));

  -- Production (planted_date fallback created_at)
  SELECT
    COALESCE(sum(parse_ptao_numeric(actual_yield)), 0),
    COALESCE(sum(parse_ptao_numeric(actual_yield) * 1000), 0),
    COALESCE(sum(parse_ptao_numeric(area)), 0)
  INTO v_total_production, v_total_yield_kg, v_total_area_prod
  FROM farmer_production pr
  WHERE
    (p_scope = 'global'
      OR EXISTS (SELECT 1 FROM farmers f WHERE f.code = pr.farmer_code
                 AND ((p_scope = 'province' AND f.province = ANY(p_provinces))
                   OR (p_scope = 'eca'      AND f.school   = ANY(p_ecas)))))
    AND (NOT v_has_period OR (COALESCE(NULLIF(pr.planted_date,'')::date, pr.created_at::date) BETWEEN p_from AND p_to));

  -- Livestock (created_at)
  SELECT COALESCE(sum(quantity), 0), count(DISTINCT farmer_id)
  INTO v_total_livestock, v_total_livestock_producers
  FROM livestock l
  WHERE
    (p_scope = 'global'
      OR EXISTS (SELECT 1 FROM farmers f WHERE f.code = l.farmer_id
                 AND ((p_scope = 'province' AND f.province = ANY(p_provinces))
                   OR (p_scope = 'eca'      AND f.school   = ANY(p_ecas)))))
    AND (NOT v_has_period OR (l.created_at::date BETWEEN p_from AND p_to));

  IF p_scope = 'global' THEN
    SELECT count(*) INTO v_critical_stock
    FROM supplier_products
    WHERE stock <= min_stock;
  END IF;

  -- Transactions (transaction_date fallback created_at)
  SELECT count(*), COALESCE(sum(parse_ptao_numeric(valor)), 0)
  INTO v_total_transactions, v_volume_transactions
  FROM farmer_transactions t
  WHERE
    (p_scope = 'global'
      OR EXISTS (SELECT 1 FROM farmers f WHERE f.code = t.farmer_code
                 AND ((p_scope = 'province' AND f.province = ANY(p_provinces))
                   OR (p_scope = 'eca'      AND f.school   = ANY(p_ecas)))))
    AND (NOT v_has_period OR (COALESCE(NULLIF(t.transaction_date,'')::date, t.created_at::date) BETWEEN p_from AND p_to));

  result := jsonb_build_object(
    'total_farmers', v_total_farmers,
    'total_approved', v_total_approved,
    'total_companies', v_total_companies,
    'total_schools', v_total_schools,
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
                                      ELSE 0 END
  );

  RETURN result;
END;
$function$;

-- New YoY function
CREATE OR REPLACE FUNCTION public.dashboard_kpis_yoy(
  p_scope text,
  p_provinces text[] DEFAULT '{}'::text[],
  p_ecas text[] DEFAULT '{}'::text[],
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current jsonb;
  v_previous jsonb;
  v_deltas jsonb := 'null'::jsonb;
  v_keys text[] := ARRAY[
    'total_farmers','total_approved','total_companies','total_schools',
    'total_parcels','total_area_ha','total_production','total_livestock',
    'total_livestock_producers','total_recebido','total_gasto',
    'utilization_rate','avg_yield_per_ha','critical_stock_count',
    'total_transactions','volume_transactions','total_reconciliado',
    'total_female','female_with_incentive','female_with_incentive_pct'
  ];
  v_key text;
  v_curr_val numeric;
  v_prev_val numeric;
  v_pct numeric;
BEGIN
  v_current := dashboard_kpis(p_scope, p_provinces, p_ecas, p_from, p_to);

  IF p_from IS NOT NULL AND p_to IS NOT NULL THEN
    v_previous := dashboard_kpis(
      p_scope, p_provinces, p_ecas,
      (p_from - interval '1 year')::date,
      (p_to   - interval '1 year')::date
    );
    v_deltas := '{}'::jsonb;
    FOREACH v_key IN ARRAY v_keys LOOP
      v_curr_val := COALESCE((v_current  ->> v_key)::numeric, 0);
      v_prev_val := COALESCE((v_previous ->> v_key)::numeric, 0);
      IF v_prev_val = 0 THEN
        v_deltas := v_deltas || jsonb_build_object(v_key, NULL);
      ELSE
        v_pct := round(((v_curr_val - v_prev_val) / v_prev_val * 100)::numeric, 1);
        v_deltas := v_deltas || jsonb_build_object(v_key, v_pct);
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'current', v_current,
    'previous', v_previous,
    'deltas', v_deltas
  );
END;
$function$;
