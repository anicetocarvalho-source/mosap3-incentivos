
-- Unique index to make supplier insert idempotent (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_name_lower_uidx ON public.suppliers (lower(name));

-- Staging table for the transactions import
CREATE TABLE IF NOT EXISTS public._tx_load_staging (
  farmer_code text,
  product text,
  empresa text,
  valor_num numeric,
  tx_date date
);
ALTER TABLE public._tx_load_staging ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin manage tx staging" ON public._tx_load_staging;
CREATE POLICY "admin manage tx staging" ON public._tx_load_staging
  FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Importer function
CREATE OR REPLACE FUNCTION public.import_farmer_transactions_from_staging()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staged int := 0;
  v_unmatched int := 0;
  v_inserted int := 0;
  v_farmers_touched int := 0;
  v_total_kz numeric := 0;
  v_before_gasto numeric := 0;
  v_after_gasto numeric := 0;
  v_suppliers_inserted int := 0;
BEGIN
  SELECT count(*) INTO v_staged FROM public._tx_load_staging;
  IF v_staged = 0 THEN
    RAISE EXCEPTION 'Staging table _tx_load_staging is empty';
  END IF;

  SELECT count(*) INTO v_unmatched
    FROM public._tx_load_staging s
    LEFT JOIN public.farmers f ON f.code = s.farmer_code
   WHERE f.code IS NULL;

  SELECT COALESCE(sum(parse_ptao_numeric(total_gasto)), 0) INTO v_before_gasto FROM public.farmers;

  -- Disable noisy triggers
  ALTER TABLE public.farmer_transactions DISABLE TRIGGER USER;

  -- Clear existing (idempotent re-import). farmer_transactions has 0 rows expected.
  DELETE FROM public.farmer_transactions;

  -- Bulk insert from staging (only for matched farmers)
  INSERT INTO public.farmer_transactions (farmer_code, product, empresa, valor, valor_num, transaction_date)
  SELECT s.farmer_code,
         COALESCE(s.product, ''),
         COALESCE(s.empresa, ''),
         public.format_ptao_numeric(s.valor_num),
         s.valor_num,
         to_char(s.tx_date, 'YYYY-MM-DD')
    FROM public._tx_load_staging s
    JOIN public.farmers f ON f.code = s.farmer_code;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- Re-enable triggers
  ALTER TABLE public.farmer_transactions ENABLE TRIGGER USER;

  -- Recompute farmers.total_gasto/saldo_final using existing helper (bypasses notification triggers)
  WITH affected AS (
    SELECT DISTINCT s.farmer_code FROM public._tx_load_staging s
    JOIN public.farmers f ON f.code = s.farmer_code
  ),
  done AS (
    SELECT public.recalc_farmer_totals(a.farmer_code) FROM affected a
  )
  SELECT count(*) INTO v_farmers_touched FROM affected;

  SELECT COALESCE(sum(valor_num), 0) INTO v_total_kz FROM public.farmer_transactions;
  SELECT COALESCE(sum(parse_ptao_numeric(total_gasto)), 0) INTO v_after_gasto FROM public.farmers;

  -- Insert 12 suppliers (idempotent on lower(name))
  WITH ins AS (
    INSERT INTO public.suppliers (name, status)
    SELECT DISTINCT s.empresa, 'Ativo'
      FROM public._tx_load_staging s
     WHERE s.empresa IS NOT NULL AND btrim(s.empresa) <> ''
    ON CONFLICT (lower(name)) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_suppliers_inserted FROM ins;

  -- Audit log
  INSERT INTO public.audit_logs (action, entity_type, user_id, user_name, details)
  VALUES (
    'bulk_import_transactions', 'farmer_transactions', auth.uid(),
    COALESCE((SELECT full_name FROM public.profiles WHERE user_id = auth.uid()), 'system'),
    jsonb_build_object(
      'source_file', 'Dados_Transacoes_Actual_Mosap.xlsx',
      'staged_rows', v_staged,
      'unmatched_rows', v_unmatched,
      'inserted_transactions', v_inserted,
      'farmers_touched', v_farmers_touched,
      'total_gasto_kz', v_total_kz,
      'farmers_total_gasto_before_kz', v_before_gasto,
      'farmers_total_gasto_after_kz', v_after_gasto,
      'suppliers_inserted', v_suppliers_inserted
    )
  );

  -- Empty staging (keep table for re-use)
  TRUNCATE public._tx_load_staging;

  RETURN jsonb_build_object(
    'staged_rows', v_staged,
    'unmatched_rows', v_unmatched,
    'inserted_transactions', v_inserted,
    'farmers_touched', v_farmers_touched,
    'total_gasto_kz', v_total_kz,
    'farmers_total_gasto_before_kz', v_before_gasto,
    'farmers_total_gasto_after_kz', v_after_gasto,
    'suppliers_inserted', v_suppliers_inserted
  );
END;
$$;
