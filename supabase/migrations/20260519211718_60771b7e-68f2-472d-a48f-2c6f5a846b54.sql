ALTER TABLE public.pos_payment_otps
  ADD COLUMN IF NOT EXISTS idempotency_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_pos_payment_otps_idem_exp
  ON public.pos_payment_otps (idempotency_expires_at)
  WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.cleanup_pos_otp_idempotency(p_max integer DEFAULT 500)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH expired AS (
    SELECT id
    FROM public.pos_payment_otps
    WHERE idempotency_key IS NOT NULL
      AND idempotency_expires_at IS NOT NULL
      AND idempotency_expires_at < now()
    LIMIT p_max
  )
  UPDATE public.pos_payment_otps p
     SET idempotency_key = NULL,
         last_result = NULL,
         idempotency_expires_at = NULL
    FROM expired
   WHERE p.id = expired.id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_pos_otp_idempotency(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_pos_otp_idempotency(integer) TO service_role;