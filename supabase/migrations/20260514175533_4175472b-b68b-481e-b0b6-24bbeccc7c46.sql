-- Índice de expressão para acelerar o join
CREATE INDEX IF NOT EXISTS idx_farmers_phone9
  ON public.farmers ((RIGHT(REGEXP_REPLACE(COALESCE(phone,''), '\D', '', 'g'), 9)));

-- Aplica em UMA única passagem usando o índice
UPDATE public.farmers f
SET sim_status = CASE s.estado
    WHEN 'Activo' THEN 'Activo'
    WHEN 'Barrado' THEN 'Barrado'
    WHEN 'Removido' THEN 'Removido'
    WHEN 'Pré desactivo' THEN 'Pré desactivado'
    WHEN 'Pré activo' THEN 'Pré activo'
    WHEN 'Desactivo' THEN 'Desactivado'
    ELSE f.sim_status
  END,
  sim_status_updated_at = now(),
  sim_status_source = 'ALL_MOSAP_xlsx_2026_05'
FROM public._sim_status_staging s
WHERE RIGHT(REGEXP_REPLACE(COALESCE(f.phone,''), '\D', '', 'g'), 9) = s.phone9;

-- Limpa staging e função auxiliar
DROP TABLE IF EXISTS public._sim_status_staging;
DROP FUNCTION IF EXISTS public.apply_sim_status_from_staging();