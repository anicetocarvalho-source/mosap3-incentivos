
CREATE TABLE IF NOT EXISTS public.client_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  message text NOT NULL,
  stack text,
  url text,
  user_agent text,
  context jsonb,
  app_version text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_errors_created
  ON public.client_errors (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_errors_user
  ON public.client_errors (user_id, created_at DESC);

ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;

-- Qualquer pessoa (mesmo anon) pode reportar um erro
CREATE POLICY "Anyone can report a client error"
  ON public.client_errors FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Só admins podem ler
CREATE POLICY "Admins can read client errors"
  ON public.client_errors FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete client errors"
  ON public.client_errors FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.cleanup_old_client_errors()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted bigint := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem executar a limpeza.';
  END IF;

  WITH d AS (
    DELETE FROM public.client_errors
    WHERE created_at < now() - INTERVAL '30 days'
    RETURNING 1
  )
  SELECT count(*) INTO v_deleted FROM d;

  RETURN v_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_client_errors() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_old_client_errors() TO authenticated;
