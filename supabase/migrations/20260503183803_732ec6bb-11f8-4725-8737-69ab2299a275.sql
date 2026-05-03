
-- Table for farmer ID cards
CREATE TABLE public.farmer_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farmer_code text NOT NULL,
  card_token text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  status text NOT NULL DEFAULT 'Rascunho',
  generated_at timestamptz,
  generated_by uuid,
  printed_at timestamptz,
  delivered_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Only one active card per farmer
CREATE UNIQUE INDEX idx_farmer_cards_active ON public.farmer_cards (farmer_code) WHERE status NOT IN ('Revogado');

ALTER TABLE public.farmer_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Backoffice can view farmer cards"
  ON public.farmer_cards FOR SELECT TO authenticated
  USING (has_any_backoffice_role(auth.uid()));

CREATE POLICY "Backoffice can insert farmer cards"
  ON public.farmer_cards FOR INSERT TO authenticated
  WITH CHECK (has_any_backoffice_role(auth.uid()));

CREATE POLICY "Backoffice can update farmer cards"
  ON public.farmer_cards FOR UPDATE TO authenticated
  USING (has_any_backoffice_role(auth.uid()));

CREATE POLICY "Admins can delete farmer cards"
  ON public.farmer_cards FOR DELETE
  USING (is_admin(auth.uid()));

-- Public read for verification page (by token only)
CREATE POLICY "Public can verify by token"
  ON public.farmer_cards FOR SELECT TO anon
  USING (true);

CREATE TRIGGER update_farmer_cards_updated_at
  BEFORE UPDATE ON public.farmer_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit log table
CREATE TABLE public.farmer_card_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farmer_code text NOT NULL,
  action text NOT NULL,
  performed_by uuid,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.farmer_card_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Backoffice can view card logs"
  ON public.farmer_card_logs FOR SELECT TO authenticated
  USING (has_any_backoffice_role(auth.uid()));

CREATE POLICY "Backoffice can insert card logs"
  ON public.farmer_card_logs FOR INSERT TO authenticated
  WITH CHECK (has_any_backoffice_role(auth.uid()));

CREATE POLICY "Admins can delete card logs"
  ON public.farmer_card_logs FOR DELETE
  USING (is_admin(auth.uid()));
