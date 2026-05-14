-- Staging temporária para importação de estados SIM do ficheiro ALL_MOSAP
CREATE TABLE IF NOT EXISTS public._sim_status_staging (
  phone9 text PRIMARY KEY,
  estado text NOT NULL
);
ALTER TABLE public._sim_status_staging ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage staging" ON public._sim_status_staging FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Limpa staging anterior se existir
TRUNCATE public._sim_status_staging;