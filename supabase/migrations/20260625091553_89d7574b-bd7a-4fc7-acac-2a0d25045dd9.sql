CREATE OR REPLACE FUNCTION public.apply_dataset_balances()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int := 0;
BEGIN
  -- Desativa triggers que recalculariam saldo a partir das transações
  ALTER TABLE public.farmers DISABLE TRIGGER USER;

  WITH upd AS (
    UPDATE public.farmers f
       SET valor_recebido = public.format_ptao_numeric(d.saldo_inicial),
           total_gasto    = public.format_ptao_numeric(d.total_gasto),
           saldo_final    = public.format_ptao_numeric(d.saldo_actual),
           updated_at     = now()
      FROM public._ds_produtores d
     WHERE f.phone = d.produtor_id
       AND (
         abs(COALESCE(public.parse_ptao_numeric(f.valor_recebido),0) - COALESCE(d.saldo_inicial,0)) > 1
         OR abs(COALESCE(public.parse_ptao_numeric(f.total_gasto),0)   - COALESCE(d.total_gasto,0))   > 1
         OR abs(COALESCE(public.parse_ptao_numeric(f.saldo_final),0)   - COALESCE(d.saldo_actual,0))  > 1
       )
    RETURNING 1
  )
  SELECT count(*) INTO v_updated FROM upd;

  ALTER TABLE public.farmers ENABLE TRIGGER USER;

  INSERT INTO public.audit_logs (action, entity_type, user_id, user_name, details)
  VALUES ('dataset_apply_balances', 'farmers', auth.uid(),
          COALESCE((SELECT full_name FROM public.profiles WHERE user_id = auth.uid()), 'system'),
          jsonb_build_object('source','mosap3-pay-dataset','farmers_updated', v_updated));

  RETURN jsonb_build_object('farmers_updated', v_updated);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_dataset_missing_farmers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted int := 0;
BEGIN
  ALTER TABLE public.farmers DISABLE TRIGGER USER;

  WITH ins AS (
    INSERT INTO public.farmers (
      code, full_name, phone, province, municipality, school, gender, status,
      valor_recebido, total_gasto, saldo_final, created_at, updated_at
    )
    SELECT
      'AGR-' || substr(d.produtor_id, 4) AS code,
      d.nome,
      d.produtor_id,
      d.provincia,
      d.municipio,
      d.eca,
      d.genero,
      'Aprovado',
      public.format_ptao_numeric(d.saldo_inicial),
      public.format_ptao_numeric(d.total_gasto),
      public.format_ptao_numeric(d.saldo_actual),
      now(), now()
    FROM public._ds_produtores d
    LEFT JOIN public.farmers f ON f.phone = d.produtor_id
    WHERE f.code IS NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_inserted FROM ins;

  ALTER TABLE public.farmers ENABLE TRIGGER USER;

  INSERT INTO public.audit_logs (action, entity_type, user_id, user_name, details)
  VALUES ('dataset_insert_missing_farmers', 'farmers', auth.uid(),
          COALESCE((SELECT full_name FROM public.profiles WHERE user_id = auth.uid()), 'system'),
          jsonb_build_object('source','mosap3-pay-dataset','farmers_inserted', v_inserted));

  RETURN jsonb_build_object('farmers_inserted', v_inserted);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_dataset_missing_tx()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted int := 0;
  v_skipped_no_farmer int := 0;
BEGIN
  ALTER TABLE public.farmer_transactions DISABLE TRIGGER USER;

  SELECT count(*) INTO v_skipped_no_farmer
    FROM public._ds_transacoes t
    LEFT JOIN public.farmers f ON f.phone = t.produtor_id
   WHERE f.code IS NULL;

  WITH ins AS (
    INSERT INTO public.farmer_transactions
      (farmer_code, product, empresa, valor, valor_num, transaction_date, external_id, categoria, created_at)
    SELECT
      f.code,
      t.produto,
      t.empresa,
      public.format_ptao_numeric(t.valor),
      t.valor,
      to_char(t.data, 'YYYY-MM-DD'),
      t.transacao_id,
      t.categoria,
      now()
    FROM public._ds_transacoes t
    JOIN public.farmers f ON f.phone = t.produtor_id
    LEFT JOIN public.farmer_transactions ft ON ft.external_id = t.transacao_id
    WHERE ft.id IS NULL
    ON CONFLICT (external_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_inserted FROM ins;

  ALTER TABLE public.farmer_transactions ENABLE TRIGGER USER;

  INSERT INTO public.audit_logs (action, entity_type, user_id, user_name, details)
  VALUES ('dataset_insert_missing_tx', 'farmer_transactions', auth.uid(),
          COALESCE((SELECT full_name FROM public.profiles WHERE user_id = auth.uid()), 'system'),
          jsonb_build_object('source','mosap3-pay-dataset','tx_inserted', v_inserted, 'tx_skipped_no_farmer', v_skipped_no_farmer));

  RETURN jsonb_build_object('tx_inserted', v_inserted, 'tx_skipped_no_farmer', v_skipped_no_farmer);
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_dataset_staging()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  TRUNCATE public._ds_produtores;
  TRUNCATE public._ds_transacoes;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_dataset_balances() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_dataset_missing_farmers() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_dataset_missing_tx() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_dataset_staging() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_dataset_balances() TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_dataset_missing_farmers() TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_dataset_missing_tx() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_dataset_staging() TO service_role;