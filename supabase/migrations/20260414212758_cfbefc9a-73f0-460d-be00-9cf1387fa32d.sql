
CREATE TABLE public.supplier_stores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  province text,
  municipality text,
  phone text,
  manager_name text,
  manager_phone text,
  status text NOT NULL DEFAULT 'Ativo',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage stores" ON public.supplier_stores
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Suppliers can manage own stores" ON public.supplier_stores
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.suppliers WHERE suppliers.id = supplier_stores.supplier_id AND suppliers.user_id = auth.uid())
  );

CREATE POLICY "Auth users can view stores" ON public.supplier_stores
  FOR SELECT USING (true);

CREATE TRIGGER update_supplier_stores_updated_at
  BEFORE UPDATE ON public.supplier_stores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
