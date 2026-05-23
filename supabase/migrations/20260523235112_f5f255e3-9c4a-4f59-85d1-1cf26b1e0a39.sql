
CREATE POLICY "Suppliers can create own otps"
  ON public.pos_payment_otps FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.suppliers s
      WHERE s.id = pos_payment_otps.supplier_id AND s.user_id = auth.uid()
    )
  );
