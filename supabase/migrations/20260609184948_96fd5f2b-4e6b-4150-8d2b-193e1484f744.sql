
-- 1. Tabela
CREATE TABLE public.farmer_patecs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id uuid NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  farmer_code text NOT NULL,
  patec_code text NOT NULL REFERENCES public.patecs(code) ON DELETE RESTRICT,
  season_id uuid REFERENCES public.agricultural_seasons(id) ON DELETE SET NULL,
  is_primary boolean NOT NULL DEFAULT false,
  assigned_by uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX farmer_patecs_unique_assignment
  ON public.farmer_patecs (farmer_id, patec_code, COALESCE(season_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX farmer_patecs_farmer_idx ON public.farmer_patecs (farmer_id);
CREATE INDEX farmer_patecs_farmer_code_idx ON public.farmer_patecs (farmer_code);
CREATE INDEX farmer_patecs_patec_code_idx ON public.farmer_patecs (patec_code);
CREATE UNIQUE INDEX farmer_patecs_one_primary_per_farmer
  ON public.farmer_patecs (farmer_id) WHERE is_primary = true;

-- 2. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.farmer_patecs TO authenticated;
GRANT ALL ON public.farmer_patecs TO service_role;

-- 3. RLS
ALTER TABLE public.farmer_patecs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Backoffice can view farmer_patecs"
  ON public.farmer_patecs FOR SELECT TO authenticated
  USING (public.has_any_backoffice_role(auth.uid()));

CREATE POLICY "Backoffice can insert farmer_patecs"
  ON public.farmer_patecs FOR INSERT TO authenticated
  WITH CHECK (public.has_any_backoffice_role(auth.uid()));

CREATE POLICY "Backoffice can update farmer_patecs"
  ON public.farmer_patecs FOR UPDATE TO authenticated
  USING (public.has_any_backoffice_role(auth.uid()))
  WITH CHECK (public.has_any_backoffice_role(auth.uid()));

CREATE POLICY "Backoffice can delete farmer_patecs"
  ON public.farmer_patecs FOR DELETE TO authenticated
  USING (public.has_any_backoffice_role(auth.uid()));

-- 4. Trigger updated_at
CREATE TRIGGER trg_farmer_patecs_updated
  BEFORE UPDATE ON public.farmer_patecs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Trigger: garantir farmer_code coerente + um único primário + sincronizar farmers.patec_code
CREATE OR REPLACE FUNCTION public.sync_farmer_patec_primary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_legacy int;
  v_count int;
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    -- preencher farmer_code se vazio
    IF NEW.farmer_code IS NULL OR NEW.farmer_code = '' THEN
      SELECT code INTO NEW.farmer_code FROM public.farmers WHERE id = NEW.farmer_id;
    END IF;

    -- Se é primeiro vínculo deste agricultor, torna-o principal
    IF TG_OP = 'INSERT' AND NOT NEW.is_primary THEN
      SELECT count(*) INTO v_count FROM public.farmer_patecs WHERE farmer_id = NEW.farmer_id;
      IF v_count = 0 THEN
        NEW.is_primary := true;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_farmer_patecs_before
  BEFORE INSERT OR UPDATE ON public.farmer_patecs
  FOR EACH ROW EXECUTE FUNCTION public.sync_farmer_patec_primary();

CREATE OR REPLACE FUNCTION public.after_farmer_patec_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_farmer_id uuid;
  v_primary record;
  v_legacy int;
BEGIN
  v_farmer_id := COALESCE(NEW.farmer_id, OLD.farmer_id);

  -- Despromover outros primários quando este é primário
  IF TG_OP IN ('INSERT','UPDATE') AND NEW.is_primary THEN
    UPDATE public.farmer_patecs
       SET is_primary = false
     WHERE farmer_id = NEW.farmer_id AND id <> NEW.id AND is_primary = true;
  END IF;

  -- Após DELETE: se removemos o primário, promover o mais recente
  IF TG_OP = 'DELETE' AND OLD.is_primary THEN
    UPDATE public.farmer_patecs
       SET is_primary = true
     WHERE id = (
       SELECT id FROM public.farmer_patecs
        WHERE farmer_id = OLD.farmer_id
        ORDER BY assigned_at DESC LIMIT 1
     );
  END IF;

  -- Sincronizar farmers.patec_code/patec com o primário actual
  SELECT fp.patec_code, p.legacy_number INTO v_primary
    FROM public.farmer_patecs fp
    JOIN public.patecs p ON p.code = fp.patec_code
   WHERE fp.farmer_id = v_farmer_id AND fp.is_primary = true
   LIMIT 1;

  IF v_primary.patec_code IS NOT NULL THEN
    UPDATE public.farmers
       SET patec_code = v_primary.patec_code,
           patec = v_primary.legacy_number,
           updated_at = now()
     WHERE id = v_farmer_id
       AND (patec_code IS DISTINCT FROM v_primary.patec_code OR patec IS DISTINCT FROM v_primary.legacy_number);
  ELSE
    -- já não há vínculos
    UPDATE public.farmers
       SET patec_code = NULL, patec = NULL, updated_at = now()
     WHERE id = v_farmer_id AND (patec_code IS NOT NULL OR patec IS NOT NULL);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_farmer_patecs_after
  AFTER INSERT OR UPDATE OR DELETE ON public.farmer_patecs
  FOR EACH ROW EXECUTE FUNCTION public.after_farmer_patec_change();

-- 6. Seed: copiar atribuições actuais
INSERT INTO public.farmer_patecs (farmer_id, farmer_code, patec_code, is_primary, assigned_at)
SELECT f.id, f.code,
       COALESCE(f.patec_code, p.code),
       true,
       COALESCE(f.updated_at, now())
  FROM public.farmers f
  LEFT JOIN public.patecs p ON p.legacy_number = f.patec
 WHERE f.patec_code IS NOT NULL OR f.patec IS NOT NULL
ON CONFLICT DO NOTHING;

-- 7. Funções helper
CREATE OR REPLACE FUNCTION public.get_farmer_patec_codes(_farmer_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(patec_code ORDER BY is_primary DESC, assigned_at DESC), '{}'::text[])
    FROM public.farmer_patecs WHERE farmer_id = _farmer_id;
$$;

CREATE OR REPLACE FUNCTION public.get_farmer_patec_codes_by_code(_farmer_code text)
RETURNS text[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(patec_code ORDER BY is_primary DESC, assigned_at DESC), '{}'::text[])
    FROM public.farmer_patecs WHERE farmer_code = _farmer_code;
$$;
