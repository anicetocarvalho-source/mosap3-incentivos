
-- Drop restrictive INSERT policies and replace with authenticated user INSERT
DROP POLICY IF EXISTS "Admins can insert livestock" ON public.livestock;
CREATE POLICY "Authenticated users can insert livestock"
ON public.livestock FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can insert livestock_health" ON public.livestock_health;
CREATE POLICY "Authenticated users can insert livestock_health"
ON public.livestock_health FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can insert livestock_production" ON public.livestock_production;
CREATE POLICY "Authenticated users can insert livestock_production"
ON public.livestock_production FOR INSERT TO authenticated
WITH CHECK (true);

-- Also allow authenticated users to update (for editing records)
DROP POLICY IF EXISTS "Admins can update livestock" ON public.livestock;
CREATE POLICY "Authenticated users can update livestock"
ON public.livestock FOR UPDATE TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can update livestock_health" ON public.livestock_health;
CREATE POLICY "Authenticated users can update livestock_health"
ON public.livestock_health FOR UPDATE TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can update livestock_production" ON public.livestock_production;
CREATE POLICY "Authenticated users can update livestock_production"
ON public.livestock_production FOR UPDATE TO authenticated
USING (true);
