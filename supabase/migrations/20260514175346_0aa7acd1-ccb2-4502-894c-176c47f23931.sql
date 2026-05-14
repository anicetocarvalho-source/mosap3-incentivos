ALTER TABLE public.farmers DROP CONSTRAINT IF EXISTS farmers_sim_status_check;
ALTER TABLE public.farmers ADD CONSTRAINT farmers_sim_status_check
  CHECK (sim_status IN ('Activo','Pendente','Pré activo','Pré desactivado','Desactivado','Barrado','Removido','Desconhecido'));