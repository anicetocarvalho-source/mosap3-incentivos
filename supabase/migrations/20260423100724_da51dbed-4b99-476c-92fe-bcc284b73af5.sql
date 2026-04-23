CREATE TABLE public.province_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  province text NOT NULL,
  generated_at timestamp with time zone NOT NULL DEFAULT now(),
  generated_by uuid,
  generated_by_name text,
  csv_file_names text[] NOT NULL DEFAULT '{}',
  confirmed_duplicates text[] NOT NULL DEFAULT '{}',
  -- Métricas resumo (denormalizadas para listagem rápida)
  total_farmers integer NOT NULL DEFAULT 0,
  total_csv_amount numeric NOT NULL DEFAULT 0,
  total_matched_amount numeric NOT NULL DEFAULT 0,
  total_orphan_amount numeric NOT NULL DEFAULT 0,
  matched_count integer NOT NULL DEFAULT 0,
  orphan_count integer NOT NULL DEFAULT 0,
  duplicate_pairs_count integer NOT NULL DEFAULT 0,
  phones_normalized integer NOT NULL DEFAULT 0,
  notes text,
  -- Payload completo (FullReview serializado) para reabrir sem recalcular
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_province_reviews_province ON public.province_reviews(province);
CREATE INDEX idx_province_reviews_generated_at ON public.province_reviews(generated_at DESC);

ALTER TABLE public.province_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and incentive managers can view province reviews"
ON public.province_reviews FOR SELECT
TO authenticated
USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'gestor_incentivos'));

CREATE POLICY "Admins and incentive managers can insert province reviews"
ON public.province_reviews FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'gestor_incentivos'));

CREATE POLICY "Admins can delete province reviews"
ON public.province_reviews FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));