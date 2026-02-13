
-- ═══════════════════════════════════════════════════════════════
-- LIVESTOCK (Pecuária) — Espécies e efectivo por produtor/escola
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.livestock (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farmer_id TEXT NOT NULL,
  school_id TEXT,
  species TEXT NOT NULL, -- Bovinos, Caprinos, Suínos, Aves, Ovinos, etc.
  breed TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  male_count INTEGER NOT NULL DEFAULT 0,
  female_count INTEGER NOT NULL DEFAULT 0,
  young_count INTEGER NOT NULL DEFAULT 0,
  pasture_area TEXT,
  infrastructure_notes TEXT, -- Currais, bebedouros, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.livestock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view livestock" ON public.livestock
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert livestock" ON public.livestock
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update livestock" ON public.livestock
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete livestock" ON public.livestock
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_livestock_updated_at
  BEFORE UPDATE ON public.livestock
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════
-- LIVESTOCK HEALTH RECORDS — Vacinações, tratamentos, mortalidade
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.livestock_health (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  livestock_id UUID NOT NULL REFERENCES public.livestock(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL, -- Vacinação, Tratamento, Mortalidade, Desparasitação
  description TEXT NOT NULL,
  quantity_affected INTEGER NOT NULL DEFAULT 1,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  veterinarian TEXT,
  cost NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.livestock_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view livestock_health" ON public.livestock_health
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert livestock_health" ON public.livestock_health
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update livestock_health" ON public.livestock_health
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete livestock_health" ON public.livestock_health
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- ═══════════════════════════════════════════════════════════════
-- LIVESTOCK PRODUCTION — Leite, ovos, carne, lã
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.livestock_production (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  livestock_id UUID NOT NULL REFERENCES public.livestock(id) ON DELETE CASCADE,
  product_type TEXT NOT NULL, -- Leite, Ovos, Carne, Lã, Mel
  quantity NUMERIC(12,2) NOT NULL,
  unit TEXT NOT NULL, -- litros, unidades, kg
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  revenue NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.livestock_production ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view livestock_production" ON public.livestock_production
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert livestock_production" ON public.livestock_production
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update livestock_production" ON public.livestock_production
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete livestock_production" ON public.livestock_production
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
