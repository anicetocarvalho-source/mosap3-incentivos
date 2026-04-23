CREATE TABLE public.orphan_phones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE,
  amount numeric NOT NULL DEFAULT 0,
  source_files text[] DEFAULT '{}',
  linked_farmer_code text,
  linked_at timestamptz,
  linked_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_orphan_phones_linked ON public.orphan_phones(linked_farmer_code) WHERE linked_farmer_code IS NOT NULL;
CREATE INDEX idx_orphan_phones_unlinked ON public.orphan_phones(phone) WHERE linked_farmer_code IS NULL;

ALTER TABLE public.orphan_phones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage orphan phones"
ON public.orphan_phones FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE TRIGGER trg_orphan_phones_updated_at
BEFORE UPDATE ON public.orphan_phones
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();