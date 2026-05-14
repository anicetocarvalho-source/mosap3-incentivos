DROP FUNCTION IF EXISTS public.farmers_sim_kpis();
CREATE FUNCTION public.farmers_sim_kpis()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'activo', COUNT(*) FILTER (WHERE sim_status = 'Activo'),
    'pendente', COUNT(*) FILTER (WHERE sim_status = 'Pendente'),
    'pre_activo', COUNT(*) FILTER (WHERE sim_status = 'Pré activo'),
    'pre_desactivado', COUNT(*) FILTER (WHERE sim_status = 'Pré desactivado'),
    'desactivado', COUNT(*) FILTER (WHERE sim_status = 'Desactivado'),
    'barrado', COUNT(*) FILTER (WHERE sim_status = 'Barrado'),
    'removido', COUNT(*) FILTER (WHERE sim_status = 'Removido'),
    'desconhecido', COUNT(*) FILTER (WHERE sim_status NOT IN ('Activo','Pendente','Pré activo','Pré desactivado','Desactivado','Barrado','Removido') OR sim_status IS NULL)
  )
  FROM public.farmers;
$$;