
-- Credit Notes table
CREATE TABLE public.credit_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  credit_note_number TEXT NOT NULL,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  original_sale_id UUID REFERENCES public.pos_sales(id),
  farmer_code TEXT NOT NULL,
  farmer_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  iva_total NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'emitida',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage credit notes" ON public.credit_notes FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Auth users can view credit notes" ON public.credit_notes FOR SELECT USING (true);
CREATE POLICY "Suppliers can insert own credit notes" ON public.credit_notes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM suppliers WHERE suppliers.id = credit_notes.supplier_id AND suppliers.user_id = auth.uid())
);

-- Credit note items
CREATE TABLE public.credit_note_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  credit_note_id UUID NOT NULL REFERENCES public.credit_notes(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  iva_rate NUMERIC NOT NULL DEFAULT 14.00,
  iva_amount NUMERIC NOT NULL DEFAULT 0,
  line_total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_note_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage cn items" ON public.credit_note_items FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Auth users can view cn items" ON public.credit_note_items FOR SELECT USING (true);
CREATE POLICY "Suppliers can insert cn items" ON public.credit_note_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM credit_notes cn JOIN suppliers s ON s.id = cn.supplier_id WHERE cn.id = credit_note_items.credit_note_id AND s.user_id = auth.uid())
);

-- Stock movements table
CREATE TABLE public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  product_id UUID NOT NULL REFERENCES public.supplier_products(id),
  movement_type TEXT NOT NULL CHECK (movement_type IN ('entrada', 'saida', 'ajuste', 'venda', 'devolucao')),
  quantity INTEGER NOT NULL,
  previous_stock INTEGER NOT NULL DEFAULT 0,
  new_stock INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  reference_id TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage stock movements" ON public.stock_movements FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Auth users can view stock movements" ON public.stock_movements FOR SELECT USING (true);
CREATE POLICY "Suppliers can insert own movements" ON public.stock_movements FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM suppliers WHERE suppliers.id = stock_movements.supplier_id AND suppliers.user_id = auth.uid())
);

-- Add min_stock to supplier_products
ALTER TABLE public.supplier_products ADD COLUMN IF NOT EXISTS min_stock INTEGER NOT NULL DEFAULT 5;

-- Audit logs table
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  user_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage audit logs" ON public.audit_logs FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Auth users can view audit logs" ON public.audit_logs FOR SELECT USING (true);
CREATE POLICY "Auth users can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (true);

-- NC sequence function (similar to invoice)
CREATE OR REPLACE FUNCTION public.next_credit_note_number(_supplier_id uuid, _year integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _next integer;
BEGIN
  INSERT INTO invoice_sequences (supplier_id, year, last_number)
  VALUES (_supplier_id, _year, 1)
  ON CONFLICT (supplier_id, year)
  DO UPDATE SET last_number = invoice_sequences.last_number + 1
  RETURNING last_number INTO _next;
  RETURN 'NC ' || _year::text || '/' || lpad(_next::text, 5, '0');
END;
$$;
