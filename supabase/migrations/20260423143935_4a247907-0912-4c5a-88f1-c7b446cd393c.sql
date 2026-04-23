-- 1. Adicionar colunas de aplicação à province_reviews
ALTER TABLE public.province_reviews
  ADD COLUMN IF NOT EXISTS applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS applied_by uuid,
  ADD COLUMN IF NOT EXISTS applied_summary jsonb;

-- Policy de UPDATE para Admin / Gestor de Incentivos (necessária para marcar applied_at)
DROP POLICY IF EXISTS "Admins and incentive managers can update province reviews" ON public.province_reviews;
CREATE POLICY "Admins and incentive managers can update province reviews"
ON public.province_reviews FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'gestor_incentivos'::app_role))
WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'gestor_incentivos'::app_role));

-- 2. Função para recalcular total_farmers de TODAS as escolas (one-shot e usada pelo trigger global)
CREATE OR REPLACE FUNCTION public.recalc_school_farmer_counts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH counts AS (
    SELECT
      s.id AS school_id,
      COALESCE(COUNT(f.code), 0)::int AS n
    FROM public.schools s
    LEFT JOIN public.provinces p ON p.id = s.province_id
    LEFT JOIN public.farmers f
      ON LOWER(TRIM(f.school)) = LOWER(TRIM(s.name))
     AND LOWER(TRIM(COALESCE(f.province, ''))) = LOWER(TRIM(COALESCE(p.name, '')))
     AND COALESCE(f.status, '') <> 'Removido'
    GROUP BY s.id
  )
  UPDATE public.schools s
     SET total_farmers = counts.n,
         updated_at = now()
    FROM counts
   WHERE counts.school_id = s.id
     AND s.total_farmers IS DISTINCT FROM counts.n;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 3. Função leve para o trigger: recalcula apenas as escolas afetadas
CREATE OR REPLACE FUNCTION public.recalc_school_for_name(_school_name text, _province_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _school_name IS NULL OR btrim(_school_name) = '' THEN RETURN; END IF;
  UPDATE public.schools s
     SET total_farmers = (
       SELECT COUNT(*)::int
         FROM public.farmers f
         LEFT JOIN public.provinces p ON p.id = s.province_id
        WHERE LOWER(TRIM(f.school)) = LOWER(TRIM(s.name))
          AND LOWER(TRIM(COALESCE(f.province, ''))) = LOWER(TRIM(COALESCE(p.name, '')))
          AND COALESCE(f.status, '') <> 'Removido'
     ),
     updated_at = now()
   WHERE LOWER(TRIM(s.name)) = LOWER(TRIM(_school_name))
     AND (
       _province_name IS NULL
       OR EXISTS (
         SELECT 1 FROM public.provinces p
         WHERE p.id = s.province_id
           AND LOWER(TRIM(p.name)) = LOWER(TRIM(_province_name))
       )
     );
END;
$$;

-- 4. Trigger em farmers para manter schools.total_farmers atualizado
CREATE OR REPLACE FUNCTION public.trg_update_school_farmer_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recalc_school_for_name(NEW.school, NEW.province);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_school_for_name(OLD.school, OLD.province);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Recalcular se mudou escola, província ou status
    IF OLD.school IS DISTINCT FROM NEW.school
       OR OLD.province IS DISTINCT FROM NEW.province
       OR OLD.status IS DISTINCT FROM NEW.status THEN
      PERFORM public.recalc_school_for_name(OLD.school, OLD.province);
      IF NEW.school IS DISTINCT FROM OLD.school OR NEW.province IS DISTINCT FROM OLD.province THEN
        PERFORM public.recalc_school_for_name(NEW.school, NEW.province);
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_school_count_on_farmer ON public.farmers;
CREATE TRIGGER trg_school_count_on_farmer
AFTER INSERT OR UPDATE OR DELETE ON public.farmers
FOR EACH ROW
EXECUTE FUNCTION public.trg_update_school_farmer_count();

-- 5. Preencher contagens iniciais
SELECT public.recalc_school_farmer_counts();