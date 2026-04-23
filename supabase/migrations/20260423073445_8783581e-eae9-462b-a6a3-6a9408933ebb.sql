CREATE TABLE IF NOT EXISTS public._tmp_valores_recebidos (
  telefone text PRIMARY KEY,
  valor numeric NOT NULL
);
TRUNCATE public._tmp_valores_recebidos;
ALTER TABLE public._tmp_valores_recebidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_tmp" ON public._tmp_valores_recebidos FOR ALL USING (is_admin(auth.uid()));