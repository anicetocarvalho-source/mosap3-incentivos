CREATE POLICY "Suppliers can view farmers for POS"
ON public.farmers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.suppliers s
    WHERE s.user_id = auth.uid()
  )
);