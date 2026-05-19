
CREATE TABLE IF NOT EXISTS public.product_price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL,
  supplier_id UUID NOT NULL,
  previous_price NUMERIC NOT NULL,
  new_price NUMERIC NOT NULL,
  delta NUMERIC GENERATED ALWAYS AS (new_price - previous_price) STORED,
  reason TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pph_product_created ON public.product_price_history (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pph_supplier_created ON public.product_price_history (supplier_id, created_at DESC);

ALTER TABLE public.product_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage price history"
ON public.product_price_history FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Backoffice can view price history"
ON public.product_price_history FOR SELECT
TO authenticated
USING (has_any_backoffice_role(auth.uid()));

CREATE POLICY "Suppliers can view own price history"
ON public.product_price_history FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM suppliers s WHERE s.id = product_price_history.supplier_id AND s.user_id = auth.uid()));

CREATE POLICY "Suppliers can insert own price history"
ON public.product_price_history FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM suppliers s WHERE s.id = product_price_history.supplier_id AND s.user_id = auth.uid())
  AND created_by = auth.uid()
);
