
-- Provinces table
CREATE TABLE public.provinces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  capital text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.provinces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view provinces"
  ON public.provinces FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert provinces"
  ON public.provinces FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update provinces"
  ON public.provinces FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete provinces"
  ON public.provinces FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Municipalities table
CREATE TABLE public.municipalities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  province_id uuid NOT NULL REFERENCES public.provinces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(name, province_id)
);

ALTER TABLE public.municipalities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view municipalities"
  ON public.municipalities FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert municipalities"
  ON public.municipalities FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update municipalities"
  ON public.municipalities FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete municipalities"
  ON public.municipalities FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Schools table
CREATE TABLE public.schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  province_id uuid NOT NULL REFERENCES public.provinces(id) ON DELETE CASCADE,
  municipality_id uuid NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  village text,
  technician text,
  technician_phone text,
  status text NOT NULL DEFAULT 'Ativa',
  total_farmers integer NOT NULL DEFAULT 0,
  total_area text,
  active_cycles integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view schools"
  ON public.schools FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert schools"
  ON public.schools FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update schools"
  ON public.schools FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete schools"
  ON public.schools FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_schools_updated_at
  BEFORE UPDATE ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
