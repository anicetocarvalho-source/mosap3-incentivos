
-- 1. patec_products
CREATE TABLE public.patec_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code text UNIQUE NOT NULL,
  name text NOT NULL,
  category text,
  subcategory text,
  unit text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.patec_products TO authenticated;
GRANT ALL ON public.patec_products TO service_role;
ALTER TABLE public.patec_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read patec_products" ON public.patec_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage patec_products" ON public.patec_products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor_incentivos'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor_incentivos'));
CREATE TRIGGER trg_patec_products_updated BEFORE UPDATE ON public.patec_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. patec_components
CREATE TABLE public.patec_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_code text UNIQUE NOT NULL,
  name text NOT NULL,
  kind text,
  base_dimension text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.patec_components TO authenticated;
GRANT ALL ON public.patec_components TO service_role;
ALTER TABLE public.patec_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read patec_components" ON public.patec_components FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage patec_components" ON public.patec_components FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor_incentivos'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor_incentivos'));
CREATE TRIGGER trg_patec_components_updated BEFORE UPDATE ON public.patec_components
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. patec_component_items (BOM)
CREATE TABLE public.patec_component_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id uuid NOT NULL REFERENCES public.patec_components(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.patec_products(id) ON DELETE RESTRICT,
  quantity numeric NOT NULL DEFAULT 0,
  unit text,
  state text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (component_id, product_id)
);
CREATE INDEX idx_patec_component_items_component ON public.patec_component_items(component_id);
GRANT SELECT ON public.patec_component_items TO authenticated;
GRANT ALL ON public.patec_component_items TO service_role;
ALTER TABLE public.patec_component_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read patec_component_items" ON public.patec_component_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage patec_component_items" ON public.patec_component_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor_incentivos'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor_incentivos'));
CREATE TRIGGER trg_patec_component_items_updated BEFORE UPDATE ON public.patec_component_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. patec_package_components
CREATE TABLE public.patec_package_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patec_id uuid NOT NULL REFERENCES public.patecs(id) ON DELETE CASCADE,
  component_id uuid NOT NULL REFERENCES public.patec_components(id) ON DELETE RESTRICT,
  is_optional boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patec_id, component_id)
);
CREATE INDEX idx_patec_package_components_patec ON public.patec_package_components(patec_id);
GRANT SELECT ON public.patec_package_components TO authenticated;
GRANT ALL ON public.patec_package_components TO service_role;
ALTER TABLE public.patec_package_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read patec_package_components" ON public.patec_package_components FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage patec_package_components" ON public.patec_package_components FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor_incentivos'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor_incentivos'));
CREATE TRIGGER trg_patec_package_components_updated BEFORE UPDATE ON public.patec_package_components
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. patec_package_expanded
CREATE TABLE public.patec_package_expanded (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patec_id uuid NOT NULL REFERENCES public.patecs(id) ON DELETE CASCADE,
  component_id uuid REFERENCES public.patec_components(id) ON DELETE SET NULL,
  product_id uuid NOT NULL REFERENCES public.patec_products(id) ON DELETE RESTRICT,
  quantity numeric NOT NULL DEFAULT 0,
  unit text,
  is_optional boolean NOT NULL DEFAULT false,
  state text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_patec_package_expanded_patec ON public.patec_package_expanded(patec_id);
CREATE INDEX idx_patec_package_expanded_patec_opt ON public.patec_package_expanded(patec_id, is_optional);
GRANT SELECT ON public.patec_package_expanded TO authenticated;
GRANT ALL ON public.patec_package_expanded TO service_role;
ALTER TABLE public.patec_package_expanded ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read patec_package_expanded" ON public.patec_package_expanded FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage patec_package_expanded" ON public.patec_package_expanded FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor_incentivos'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor_incentivos'));
CREATE TRIGGER trg_patec_package_expanded_updated BEFORE UPDATE ON public.patec_package_expanded
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
