
-- Table to track invoice sequences per supplier per year
CREATE TABLE public.invoice_sequences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE CASCADE,
  year integer NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, year)
);

ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view sequences" ON public.invoice_sequences FOR SELECT USING (true);
CREATE POLICY "Admins can manage sequences" ON public.invoice_sequences FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Suppliers can manage own sequences" ON public.invoice_sequences FOR ALL USING (
  EXISTS (SELECT 1 FROM suppliers WHERE suppliers.id = invoice_sequences.supplier_id AND suppliers.user_id = auth.uid())
);

-- Add invoice_number column to pos_sales
ALTER TABLE public.pos_sales ADD COLUMN invoice_number text UNIQUE;

-- Atomic function to get next invoice number
CREATE OR REPLACE FUNCTION public.next_invoice_number(_supplier_id uuid, _year integer)
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

  RETURN 'FT ' || _year::text || '/' || lpad(_next::text, 5, '0');
END;
$$;
