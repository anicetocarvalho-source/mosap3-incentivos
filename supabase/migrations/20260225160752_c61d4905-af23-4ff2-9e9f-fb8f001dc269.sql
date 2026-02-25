-- Allow authenticated users to insert their own supplier record (for self-registration)
CREATE POLICY "Users can register as supplier"
ON public.suppliers
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to view all suppliers (needed for POS supplier selection)
CREATE POLICY "Auth users can view suppliers"
ON public.suppliers
FOR SELECT
TO authenticated
USING (true);