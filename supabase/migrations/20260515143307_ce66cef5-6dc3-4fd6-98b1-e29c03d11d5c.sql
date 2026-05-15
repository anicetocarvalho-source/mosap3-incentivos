CREATE TABLE IF NOT EXISTS public._xlsx_recon_staging (
  phone text PRIMARY KEY,
  recebido numeric NOT NULL DEFAULT 0,
  gasto numeric NOT NULL DEFAULT 0,
  n integer NOT NULL DEFAULT 0,
  nome text,
  prov text,
  muni text,
  ecas text
);
ALTER TABLE public._xlsx_recon_staging ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage staging" ON public._xlsx_recon_staging
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
TRUNCATE public._xlsx_recon_staging;