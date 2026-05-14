CREATE OR REPLACE FUNCTION public.apply_sim_status_from_staging()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  WITH upd AS (
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
    WHERE RIGHT(REGEXP_REPLACE(COALESCE(f.phone,''), '\D', '', 'g'), 9) = s.phone9
    RETURNING 1
  )
  SELECT count(*)::int INTO affected FROM upd;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_sim_status_from_staging() FROM anon, authenticated;