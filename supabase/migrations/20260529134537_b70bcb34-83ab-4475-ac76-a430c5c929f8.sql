
-- Análise de preços de produtos de fornecedores
-- Função para detectar preços anormais vs média de mercado

CREATE OR REPLACE FUNCTION public.analyze_supplier_prices(
  p_min_suppliers integer DEFAULT 3,
  p_high_pct numeric DEFAULT 40,
  p_medium_pct numeric DEFAULT 25
)
RETURNS TABLE (
  product_key text,
  product_id uuid,
  product_name text,
  category text,
  unit text,
  supplier_id uuid,
  supplier_name text,
  current_price numeric,
  avg_price numeric,
  median_price numeric,
  min_price numeric,
  max_price numeric,
  stddev_price numeric,
  suppliers_count integer,
  deviation_pct numeric,
  severity text,
  last_changed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      lower(sp.name) || '|' || sp.category || '|' || sp.unit AS product_key,
      sp.id AS product_id,
      sp.name AS product_name,
      sp.category,
      sp.unit,
      sp.supplier_id,
      s.name AS supplier_name,
      sp.price AS current_price
    FROM public.supplier_products sp
    JOIN public.suppliers s ON s.id = sp.supplier_id
    WHERE sp.status = 'Ativo' AND sp.price > 0
  ),
  agg AS (
    SELECT
      product_key,
      AVG(current_price)::numeric AS avg_price,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY current_price)::numeric AS median_price,
      MIN(current_price) AS min_price,
      MAX(current_price) AS max_price,
      COALESCE(STDDEV_POP(current_price), 0)::numeric AS stddev_price,
      COUNT(DISTINCT supplier_id)::int AS suppliers_count
    FROM base
    GROUP BY product_key
  ),
  joined AS (
    SELECT
      b.product_key,
      b.product_id,
      b.product_name,
      b.category,
      b.unit,
      b.supplier_id,
      b.supplier_name,
      b.current_price,
      a.avg_price,
      a.median_price,
      a.min_price,
      a.max_price,
      a.stddev_price,
      a.suppliers_count,
      CASE WHEN a.avg_price > 0
        THEN ROUND(((b.current_price - a.avg_price) / a.avg_price * 100)::numeric, 2)
        ELSE 0 END AS deviation_pct
    FROM base b
    JOIN agg a USING (product_key)
    WHERE a.suppliers_count >= p_min_suppliers
  )
  SELECT
    j.product_key,
    j.product_id,
    j.product_name,
    j.category,
    j.unit,
    j.supplier_id,
    j.supplier_name,
    j.current_price,
    j.avg_price,
    j.median_price,
    j.min_price,
    j.max_price,
    j.stddev_price,
    j.suppliers_count,
    j.deviation_pct,
    CASE
      WHEN j.deviation_pct >= p_high_pct
        OR (j.stddev_price > 0 AND ABS(j.current_price - j.avg_price) > 2 * j.stddev_price AND j.deviation_pct > 0)
        THEN 'alta'
      WHEN j.deviation_pct >= p_medium_pct THEN 'media'
      WHEN j.deviation_pct <= -p_medium_pct THEN 'baixa'
      ELSE 'normal'
    END AS severity,
    (SELECT MAX(created_at) FROM public.product_price_history pph WHERE pph.product_id = j.product_id) AS last_changed_at
  FROM joined j
  ORDER BY ABS(j.deviation_pct) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.analyze_supplier_prices(integer, numeric, numeric) TO authenticated;

-- Função: variações abruptas de preço
CREATE OR REPLACE FUNCTION public.detect_abrupt_price_changes(
  p_days integer DEFAULT 90,
  p_threshold_pct numeric DEFAULT 25
)
RETURNS TABLE (
  id uuid,
  product_id uuid,
  product_name text,
  supplier_id uuid,
  supplier_name text,
  previous_price numeric,
  new_price numeric,
  delta numeric,
  change_pct numeric,
  reason text,
  created_by uuid,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pph.id,
    pph.product_id,
    sp.name AS product_name,
    pph.supplier_id,
    s.name AS supplier_name,
    pph.previous_price,
    pph.new_price,
    pph.delta,
    CASE WHEN pph.previous_price > 0
      THEN ROUND(((pph.new_price - pph.previous_price) / pph.previous_price * 100)::numeric, 2)
      ELSE 0 END AS change_pct,
    pph.reason,
    pph.created_by,
    pph.created_at
  FROM public.product_price_history pph
  JOIN public.supplier_products sp ON sp.id = pph.product_id
  JOIN public.suppliers s ON s.id = pph.supplier_id
  WHERE pph.created_at >= now() - (p_days || ' days')::interval
    AND pph.previous_price > 0
    AND ABS((pph.new_price - pph.previous_price) / pph.previous_price * 100) >= p_threshold_pct
  ORDER BY pph.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.detect_abrupt_price_changes(integer, numeric) TO authenticated;
