-- 1) Coluna gerada para suportar ranges e ordenação por valor
ALTER TABLE public.farmer_transactions
  ADD COLUMN IF NOT EXISTS valor_num numeric
  GENERATED ALWAYS AS (public.parse_ptao_numeric(valor)) STORED;

CREATE INDEX IF NOT EXISTS idx_ftx_valor_num ON public.farmer_transactions (valor_num);
CREATE INDEX IF NOT EXISTS idx_ftx_valor_num_desc ON public.farmer_transactions (valor_num DESC);

-- 2) RPC com KPIs reactivos aos filtros da página
CREATE OR REPLACE FUNCTION public.transacoes_kpis(
  p_search   text DEFAULT NULL,
  p_empresa  text DEFAULT NULL,
  p_product  text DEFAULT NULL,
  p_farmer   text DEFAULT NULL,
  p_min      numeric DEFAULT NULL,
  p_max      numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_count    bigint := 0;
  v_total_volume   numeric := 0;
  v_min            numeric := 0;
  v_max            numeric := 0;
  v_avg            numeric := 0;
  v_top_products   jsonb := '[]'::jsonb;
  v_top_empresas   jsonb := '[]'::jsonb;
  v_top_products_n jsonb := '[]'::jsonb;
  v_top_empresas_n jsonb := '[]'::jsonb;
  v_search         text := NULLIF(btrim(coalesce(p_search,'')), '');
  v_farmer         text := NULLIF(btrim(coalesce(p_farmer,'')), '');
BEGIN
  WITH base AS (
    SELECT t.farmer_code, t.empresa, t.product, t.valor_num, f.full_name
    FROM public.farmer_transactions t
    LEFT JOIN public.farmers f ON f.code = t.farmer_code
    WHERE
      (p_empresa IS NULL OR p_empresa = '' OR p_empresa = 'all' OR t.empresa = p_empresa)
      AND (p_product IS NULL OR p_product = '' OR p_product = 'all' OR t.product = p_product)
      AND (p_min IS NULL OR t.valor_num >= p_min)
      AND (p_max IS NULL OR t.valor_num <= p_max)
      AND (
        v_search IS NULL OR
        t.farmer_code ILIKE '%'||v_search||'%' OR
        t.empresa     ILIKE '%'||v_search||'%' OR
        t.product     ILIKE '%'||v_search||'%'
      )
      AND (
        v_farmer IS NULL OR
        t.farmer_code ILIKE '%'||v_farmer||'%' OR
        f.full_name   ILIKE '%'||v_farmer||'%'
      )
  )
  SELECT
    count(*),
    COALESCE(sum(valor_num), 0),
    COALESCE(min(valor_num), 0),
    COALESCE(max(valor_num), 0),
    COALESCE(avg(valor_num), 0)
  INTO v_total_count, v_total_volume, v_min, v_max, v_avg
  FROM base;

  -- Top 5 por volume (Kz)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('product', product, 'total_kz', total_kz, 'count', n) ORDER BY total_kz DESC), '[]'::jsonb)
  INTO v_top_products
  FROM (
    SELECT t.product, COALESCE(sum(t.valor_num),0) AS total_kz, count(*) AS n
    FROM public.farmer_transactions t
    LEFT JOIN public.farmers f ON f.code = t.farmer_code
    WHERE
      (p_empresa IS NULL OR p_empresa = '' OR p_empresa = 'all' OR t.empresa = p_empresa)
      AND (p_product IS NULL OR p_product = '' OR p_product = 'all' OR t.product = p_product)
      AND (p_min IS NULL OR t.valor_num >= p_min)
      AND (p_max IS NULL OR t.valor_num <= p_max)
      AND (v_search IS NULL OR t.farmer_code ILIKE '%'||v_search||'%' OR t.empresa ILIKE '%'||v_search||'%' OR t.product ILIKE '%'||v_search||'%')
      AND (v_farmer IS NULL OR t.farmer_code ILIKE '%'||v_farmer||'%' OR f.full_name ILIKE '%'||v_farmer||'%')
    GROUP BY t.product
    ORDER BY total_kz DESC
    LIMIT 5
  ) s;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('empresa', empresa, 'total_kz', total_kz, 'count', n) ORDER BY total_kz DESC), '[]'::jsonb)
  INTO v_top_empresas
  FROM (
    SELECT t.empresa, COALESCE(sum(t.valor_num),0) AS total_kz, count(*) AS n
    FROM public.farmer_transactions t
    LEFT JOIN public.farmers f ON f.code = t.farmer_code
    WHERE
      (p_empresa IS NULL OR p_empresa = '' OR p_empresa = 'all' OR t.empresa = p_empresa)
      AND (p_product IS NULL OR p_product = '' OR p_product = 'all' OR t.product = p_product)
      AND (p_min IS NULL OR t.valor_num >= p_min)
      AND (p_max IS NULL OR t.valor_num <= p_max)
      AND (v_search IS NULL OR t.farmer_code ILIKE '%'||v_search||'%' OR t.empresa ILIKE '%'||v_search||'%' OR t.product ILIKE '%'||v_search||'%')
      AND (v_farmer IS NULL OR t.farmer_code ILIKE '%'||v_farmer||'%' OR f.full_name ILIKE '%'||v_farmer||'%')
    GROUP BY t.empresa
    ORDER BY total_kz DESC
    LIMIT 5
  ) s;

  -- Top 5 por nº de vendas
  SELECT COALESCE(jsonb_agg(jsonb_build_object('product', product, 'total_kz', total_kz, 'count', n) ORDER BY n DESC), '[]'::jsonb)
  INTO v_top_products_n
  FROM (
    SELECT t.product, COALESCE(sum(t.valor_num),0) AS total_kz, count(*) AS n
    FROM public.farmer_transactions t
    LEFT JOIN public.farmers f ON f.code = t.farmer_code
    WHERE
      (p_empresa IS NULL OR p_empresa = '' OR p_empresa = 'all' OR t.empresa = p_empresa)
      AND (p_product IS NULL OR p_product = '' OR p_product = 'all' OR t.product = p_product)
      AND (p_min IS NULL OR t.valor_num >= p_min)
      AND (p_max IS NULL OR t.valor_num <= p_max)
      AND (v_search IS NULL OR t.farmer_code ILIKE '%'||v_search||'%' OR t.empresa ILIKE '%'||v_search||'%' OR t.product ILIKE '%'||v_search||'%')
      AND (v_farmer IS NULL OR t.farmer_code ILIKE '%'||v_farmer||'%' OR f.full_name ILIKE '%'||v_farmer||'%')
    GROUP BY t.product
    ORDER BY n DESC
    LIMIT 5
  ) s;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('empresa', empresa, 'total_kz', total_kz, 'count', n) ORDER BY n DESC), '[]'::jsonb)
  INTO v_top_empresas_n
  FROM (
    SELECT t.empresa, COALESCE(sum(t.valor_num),0) AS total_kz, count(*) AS n
    FROM public.farmer_transactions t
    LEFT JOIN public.farmers f ON f.code = t.farmer_code
    WHERE
      (p_empresa IS NULL OR p_empresa = '' OR p_empresa = 'all' OR t.empresa = p_empresa)
      AND (p_product IS NULL OR p_product = '' OR p_product = 'all' OR t.product = p_product)
      AND (p_min IS NULL OR t.valor_num >= p_min)
      AND (p_max IS NULL OR t.valor_num <= p_max)
      AND (v_search IS NULL OR t.farmer_code ILIKE '%'||v_search||'%' OR t.empresa ILIKE '%'||v_search||'%' OR t.product ILIKE '%'||v_search||'%')
      AND (v_farmer IS NULL OR t.farmer_code ILIKE '%'||v_farmer||'%' OR f.full_name ILIKE '%'||v_farmer||'%')
    GROUP BY t.empresa
    ORDER BY n DESC
    LIMIT 5
  ) s;

  RETURN jsonb_build_object(
    'total_count', v_total_count,
    'total_volume_kz', v_total_volume,
    'min_valor', v_min,
    'max_valor', v_max,
    'avg_valor', v_avg,
    'top_products', v_top_products,
    'top_empresas', v_top_empresas,
    'top_products_by_count', v_top_products_n,
    'top_empresas_by_count', v_top_empresas_n
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.transacoes_kpis(text,text,text,text,numeric,numeric) TO authenticated;