CREATE OR REPLACE FUNCTION public.dashboard_kpis(p_scope text, p_provinces text[] DEFAULT '{}'::text[], p_ecas text[] DEFAULT '{}'::text[])
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
BEGIN
  WITH scoped AS (
    SELECT code, status, valor_recebido, total_gasto, school, gender
    FROM farmers
    WHERE
      p_scope = 'global'
      OR (p_scope = 'province' AND province = ANY(p_provinces))
      OR (p_scope = 'eca'      AND school   = ANY(p_ecas))
  )
  SELECT
    count(*),
    count(*) FILTER (WHERE status = 'Aprovado'),
    COALESCE(sum(parse_ptao_numeric(valor_recebido)), 0),
    COALESCE(sum(parse_ptao_numeric(total_gasto)), 0),
    count(*) FILTER (WHERE gender = 'Feminino'),
    count(*) FILTER (WHERE gender = 'Feminino' AND parse_ptao_numeric(valor_recebido) > 0)
  INTO v_total_farmers, v_total_approved, v_total_recebido, v_total_gasto, v_total_female, v_female_with_incentive
  FROM scoped;

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

  SELECT count(*), COALESCE(sum(parse_ptao_numeric(area)), 0)
  INTO v_total_parcels, v_total_area_ha
  FROM farmer_parcels p
  WHERE
    p_scope = 'global'
    OR EXISTS (SELECT 1 FROM farmers f WHERE f.code = p.farmer_code
               AND ((p_scope = 'province' AND f.province = ANY(p_provinces))
                 OR (p_scope = 'eca'      AND f.school   = ANY(p_ecas))));

  SELECT
    COALESCE(sum(parse_ptao_numeric(actual_yield)), 0),
    COALESCE(sum(parse_ptao_numeric(actual_yield) * 1000), 0),
    COALESCE(sum(parse_ptao_numeric(area)), 0)
  INTO v_total_production, v_total_yield_kg, v_total_area_prod
  FROM farmer_production pr
  WHERE
    p_scope = 'global'
    OR EXISTS (SELECT 1 FROM farmers f WHERE f.code = pr.farmer_code
               AND ((p_scope = 'province' AND f.province = ANY(p_provinces))
                 OR (p_scope = 'eca'      AND f.school   = ANY(p_ecas))));

  SELECT COALESCE(sum(quantity), 0), count(DISTINCT farmer_id)
  INTO v_total_livestock, v_total_livestock_producers
  FROM livestock l
  WHERE
    p_scope = 'global'
    OR EXISTS (SELECT 1 FROM farmers f WHERE f.code = l.farmer_id
               AND ((p_scope = 'province' AND f.province = ANY(p_provinces))
                 OR (p_scope = 'eca'      AND f.school   = ANY(p_ecas))));

  IF p_scope = 'global' THEN
    SELECT count(*) INTO v_critical_stock
    FROM supplier_products
    WHERE stock <= min_stock;
  END IF;

  SELECT count(*), COALESCE(sum(parse_ptao_numeric(valor)), 0)
  INTO v_total_transactions, v_volume_transactions
  FROM farmer_transactions t
  WHERE
    p_scope = 'global'
    OR EXISTS (SELECT 1 FROM farmers f WHERE f.code = t.farmer_code
               AND ((p_scope = 'province' AND f.province = ANY(p_provinces))
                 OR (p_scope = 'eca'      AND f.school   = ANY(p_ecas))));

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