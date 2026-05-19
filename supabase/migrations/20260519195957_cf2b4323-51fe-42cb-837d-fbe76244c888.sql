
CREATE TABLE IF NOT EXISTS public.pos_payment_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL,
  farmer_code text NOT NULL,
  phone text NOT NULL,
  code_hash text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  attempts int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  used_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pos_payment_otps_farmer_status
  ON public.pos_payment_otps (farmer_code, status, expires_at DESC);

ALTER TABLE public.pos_payment_otps ENABLE ROW LEVEL SECURITY;

-- Only admins can read/manage from the client; edge functions use service role and bypass RLS.
CREATE POLICY "Admins can manage pos_payment_otps"
  ON public.pos_payment_otps
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
