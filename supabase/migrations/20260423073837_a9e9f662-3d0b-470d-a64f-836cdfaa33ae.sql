CREATE TABLE IF NOT EXISTS public._tmp_valores_recebidos (
  telefone text PRIMARY KEY,
  valor numeric NOT NULL
);
ALTER TABLE public._tmp_valores_recebidos DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public._tmp_valores_recebidos TO sandbox_exec, anon, authenticated, service_role;