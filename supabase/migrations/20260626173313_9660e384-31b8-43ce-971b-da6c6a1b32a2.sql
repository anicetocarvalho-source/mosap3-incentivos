CREATE OR REPLACE FUNCTION public.undo_dataset_tx_insert()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_deleted int;
BEGIN
  ALTER TABLE public.farmer_transactions DISABLE TRIGGER USER;
  WITH d AS (DELETE FROM public.farmer_transactions WHERE external_id IS NOT NULL RETURNING 1)
  SELECT count(*) INTO v_deleted FROM d;
  ALTER TABLE public.farmer_transactions ENABLE TRIGGER USER;
  RETURN jsonb_build_object('deleted', v_deleted);
END $$;

CREATE OR REPLACE FUNCTION public.backfill_dataset_tx_external_id()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_updated int;
BEGIN
  ALTER TABLE public.farmer_transactions DISABLE TRIGGER USER;
  WITH ranked AS (
    SELECT ft.id, t.transacao_id,
      row_number() OVER (PARTITION BY t.transacao_id ORDER BY ft.created_at) AS rn_t,
      row_number() OVER (PARTITION BY ft.id ORDER BY t.data) AS rn_f
    FROM public.farmer_transactions ft
    JOIN public.farmers f ON f.code = ft.farmer_code
    JOIN public._ds_transacoes t
      ON t.produtor_id = f.phone
     AND to_char(t.data,'YYYY-MM-DD') = ft.transaction_date
     AND abs(t.valor - COALESCE(ft.valor_num,0)) < 0.5
    WHERE ft.external_id IS NULL
  ),
  upd AS (
    UPDATE public.farmer_transactions ft
       SET external_id = r.transacao_id
      FROM ranked r
     WHERE ft.id = r.id AND r.rn_t = 1 AND r.rn_f = 1
    RETURNING 1
  )
  SELECT count(*) INTO v_updated FROM upd;
  ALTER TABLE public.farmer_transactions ENABLE TRIGGER USER;
  RETURN jsonb_build_object('updated', v_updated);
END $$;

ALTER FUNCTION public.undo_dataset_tx_insert() SET statement_timeout = '600s';
ALTER FUNCTION public.backfill_dataset_tx_external_id() SET statement_timeout = '600s';
REVOKE ALL ON FUNCTION public.undo_dataset_tx_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.backfill_dataset_tx_external_id() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.undo_dataset_tx_insert() TO service_role;
GRANT EXECUTE ON FUNCTION public.backfill_dataset_tx_external_id() TO service_role;