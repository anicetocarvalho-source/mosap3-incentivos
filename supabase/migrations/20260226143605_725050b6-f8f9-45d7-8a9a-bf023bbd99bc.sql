
CREATE TABLE public.supplier_provinces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  province_id UUID NOT NULL REFERENCES public.provinces(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(supplier_id, province_id)
);

ALTER TABLE public.supplier_provinces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage supplier_provinces" ON public.supplier_provinces FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Auth users can view supplier_provinces" ON public.supplier_provinces FOR SELECT USING (true);
CREATE POLICY "Suppliers can manage own provinces" ON public.supplier_provinces FOR ALL USING (
  EXISTS (SELECT 1 FROM suppliers WHERE suppliers.id = supplier_provinces.supplier_id AND suppliers.user_id = auth.uid())
);
