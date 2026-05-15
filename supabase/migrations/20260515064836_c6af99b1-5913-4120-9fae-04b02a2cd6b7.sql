
-- 1. Tabela patecs
CREATE TABLE public.patecs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  cultures text,
  icon text NOT NULL DEFAULT 'wheat',
  color_token text NOT NULL DEFAULT 'amber',
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  legacy_number int UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.patecs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view patecs"
  ON public.patecs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage patecs"
  ON public.patecs FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE TRIGGER trg_patecs_updated_at BEFORE UPDATE ON public.patecs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Tabela agricultural_seasons
CREATE TABLE public.agricultural_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.agricultural_seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view seasons"
  ON public.agricultural_seasons FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage seasons"
  ON public.agricultural_seasons FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.validate_season_dates()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.end_date <= NEW.start_date THEN
    RAISE EXCEPTION 'A data de fim deve ser posterior à data de início';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_seasons_validate BEFORE INSERT OR UPDATE ON public.agricultural_seasons
  FOR EACH ROW EXECUTE FUNCTION public.validate_season_dates();
CREATE TRIGGER trg_seasons_updated_at BEFORE UPDATE ON public.agricultural_seasons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Tabela junção patec_seasons
CREATE TABLE public.patec_seasons (
  patec_id uuid NOT NULL REFERENCES public.patecs(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES public.agricultural_seasons(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (patec_id, season_id)
);
ALTER TABLE public.patec_seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view patec_seasons"
  ON public.patec_seasons FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage patec_seasons"
  ON public.patec_seasons FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- 4. Adicionar patec_code às tabelas existentes
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS patec_code text;
ALTER TABLE public.patec_items ADD COLUMN IF NOT EXISTS patec_code text;
ALTER TABLE public.pos_sales ADD COLUMN IF NOT EXISTS patec_code text;

CREATE INDEX IF NOT EXISTS idx_farmers_patec_code ON public.farmers(patec_code);
CREATE INDEX IF NOT EXISTS idx_patec_items_patec_code ON public.patec_items(patec_code);
CREATE INDEX IF NOT EXISTS idx_pos_sales_patec_code ON public.pos_sales(patec_code);

-- 5. Seed dos PATECs iniciais (legacy 1, 2, 3)
INSERT INTO public.patecs (code, name, description, cultures, icon, color_token, sort_order, legacy_number) VALUES
  ('PATEC-MILHO', 'Milho + Feijão + Gado', 'Pacote tecnológico para produção de milho e feijão com componente pecuária.', 'Milho + Feijão', 'wheat', 'amber', 1, 1),
  ('PATEC-MASSANGO', 'Massango + Feijão + Gado', 'Pacote tecnológico para produção de massango e feijão com componente pecuária.', 'Massango + Feijão', 'sprout', 'emerald', 2, 2),
  ('PATEC-MASSAMBALA', 'Massambala + Feijão + Gado', 'Pacote tecnológico para produção de massambala e feijão com componente pecuária.', 'Massambala + Feijão', 'leaf', 'violet', 3, 3)
ON CONFLICT (code) DO NOTHING;

-- 6. Backfill patec_code a partir de legacy_number
UPDATE public.farmers f SET patec_code = p.code
  FROM public.patecs p WHERE f.patec = p.legacy_number AND f.patec_code IS NULL;

UPDATE public.patec_items i SET patec_code = p.code
  FROM public.patecs p WHERE i.patec_number = p.legacy_number AND i.patec_code IS NULL;

UPDATE public.pos_sales s SET patec_code = p.code
  FROM public.patecs p WHERE s.patec_number = p.legacy_number AND s.patec_code IS NULL;

-- 7. Função is_patec_available
CREATE OR REPLACE FUNCTION public.is_patec_available(_code text, _at timestamptz DEFAULT now())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.patecs p
    JOIN public.patec_seasons ps ON ps.patec_id = p.id
    JOIN public.agricultural_seasons s ON s.id = ps.season_id
    WHERE p.code = _code
      AND p.is_active = true
      AND s.is_active = true
      AND _at::date BETWEEN s.start_date AND s.end_date
  )
$$;

-- 8. Contagem dinâmica de agricultores por código
CREATE OR REPLACE FUNCTION public.dashboard_patec_counts(p_scope text DEFAULT 'global', p_provinces text[] DEFAULT '{}'::text[], p_ecas text[] DEFAULT '{}'::text[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(jsonb_object_agg(code, n), '{}'::jsonb)
  FROM (
    SELECT COALESCE(f.patec_code, 'sem_patec') AS code, count(*)::int AS n
    FROM public.farmers f
    WHERE (p_scope = 'global'
        OR (p_scope = 'province' AND f.province = ANY(p_provinces))
        OR (p_scope = 'eca'      AND f.school   = ANY(p_ecas)))
    GROUP BY COALESCE(f.patec_code, 'sem_patec')
  ) s;
$$;
