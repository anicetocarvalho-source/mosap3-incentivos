ALTER TABLE public.farmer_transactions ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE public.farmer_transactions ADD COLUMN IF NOT EXISTS categoria text;
CREATE UNIQUE INDEX IF NOT EXISTS farmer_transactions_external_id_uniq ON public.farmer_transactions(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS farmer_transactions_farmer_code_idx ON public.farmer_transactions(farmer_code);