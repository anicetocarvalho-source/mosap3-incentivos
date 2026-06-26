CREATE INDEX IF NOT EXISTS farmer_transactions_ext_id_btree ON public.farmer_transactions (external_id);

ALTER FUNCTION public.apply_dataset_missing_tx() SET statement_timeout = '600s';
ALTER FUNCTION public.apply_dataset_balances() SET statement_timeout = '600s';
ALTER FUNCTION public.apply_dataset_missing_farmers() SET statement_timeout = '600s';