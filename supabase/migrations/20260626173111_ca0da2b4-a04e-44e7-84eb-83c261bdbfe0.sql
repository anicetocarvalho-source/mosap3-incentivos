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
      (farmer_code, product, empresa, valor, transaction_date, external_id, categoria, created_at)
    SELECT DISTINCT ON (t.transacao_id)
      f.code, t.produto, t.empresa,
      public.format_ptao_numeric(t.valor),
      to_char(t.data, 'YYYY-MM-DD'),
      t.transacao_id, t.categoria, now()
    FROM public._ds_transacoes t
    JOIN public.farmers f ON f.phone = t.produtor_id
    LEFT JOIN public.farmer_transactions ft ON ft.external_id = t.transacao_id
    WHERE ft.id IS NULL
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