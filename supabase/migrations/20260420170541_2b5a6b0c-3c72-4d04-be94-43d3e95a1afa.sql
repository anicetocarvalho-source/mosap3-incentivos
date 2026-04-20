CREATE POLICY "Suppliers can insert audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.suppliers s
    WHERE s.user_id = auth.uid()
  )
  AND user_id = auth.uid()
);