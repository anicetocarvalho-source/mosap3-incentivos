
CREATE TABLE public.price_alert_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  reviewed_price numeric NOT NULL,
  reviewed_by uuid NOT NULL,
  reviewer_name text,
  notes text,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, supplier_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_alert_reviews TO authenticated;
GRANT ALL ON public.price_alert_reviews TO service_role;

ALTER TABLE public.price_alert_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Backoffice can view price alert reviews"
ON public.price_alert_reviews FOR SELECT TO authenticated
USING (has_any_backoffice_role(auth.uid()));

CREATE POLICY "Backoffice can insert price alert reviews"
ON public.price_alert_reviews FOR INSERT TO authenticated
WITH CHECK (has_any_backoffice_role(auth.uid()) AND reviewed_by = auth.uid());

CREATE POLICY "Backoffice can update price alert reviews"
ON public.price_alert_reviews FOR UPDATE TO authenticated
USING (has_any_backoffice_role(auth.uid()))
WITH CHECK (has_any_backoffice_role(auth.uid()));

CREATE POLICY "Admins can delete price alert reviews"
ON public.price_alert_reviews FOR DELETE TO authenticated
USING (is_admin(auth.uid()));

CREATE INDEX idx_price_alert_reviews_pair ON public.price_alert_reviews(product_id, supplier_id);
