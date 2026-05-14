-- 1) Alargar CHECK constraint para incluir 'Pendente'
ALTER TABLE public.farmers DROP CONSTRAINT IF EXISTS farmers_sim_status_check;
ALTER TABLE public.farmers
  ADD CONSTRAINT farmers_sim_status_check
  CHECK (sim_status IN ('Activo', 'Pendente', 'Removido', 'Barrado', 'Pré desactivado', 'Desconhecido'));

-- 2) Actualizar RPC farmers_sim_kpis para devolver tambem 'pendente'
CREATE OR REPLACE FUNCTION public.farmers_sim_kpis()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'activo',          COUNT(*) FILTER (WHERE COALESCE(sim_status,'Desconhecido') = 'Activo'),
    'pendente',        COUNT(*) FILTER (WHERE COALESCE(sim_status,'Desconhecido') = 'Pendente'),
    'pre_desactivado', COUNT(*) FILTER (WHERE COALESCE(sim_status,'Desconhecido') = 'Pré desactivado'),
    'barrado',         COUNT(*) FILTER (WHERE COALESCE(sim_status,'Desconhecido') = 'Barrado'),
    'removido',        COUNT(*) FILTER (WHERE COALESCE(sim_status,'Desconhecido') = 'Removido'),
    'desconhecido',    COUNT(*) FILTER (WHERE COALESCE(sim_status,'Desconhecido') = 'Desconhecido')
  )
  FROM public.farmers;
$$;