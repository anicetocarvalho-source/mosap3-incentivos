ALTER TABLE public.pos_payment_otps
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS last_result jsonb;

CREATE INDEX IF NOT EXISTS idx_pos_payment_otps_idem ON public.pos_payment_otps (id, idempotency_key);