ALTER TABLE public._tmp_valores_recebidos DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public._tmp_valores_recebidos TO anon, authenticated, service_role;