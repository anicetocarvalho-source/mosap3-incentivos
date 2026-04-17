-- 1. Helper function: checks if user has any backoffice role
CREATE OR REPLACE FUNCTION public.has_any_backoffice_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id
  )
$$;

-- 2. farmers
DROP POLICY IF EXISTS "Authenticated users can insert farmers" ON public.farmers;
DROP POLICY IF EXISTS "Authenticated users can update farmers" ON public.farmers;
DROP POLICY IF EXISTS "Authenticated users can view farmers" ON public.farmers;
CREATE POLICY "Backoffice can insert farmers" ON public.farmers FOR INSERT TO authenticated WITH CHECK (has_any_backoffice_role(auth.uid()));
CREATE POLICY "Backoffice can update farmers" ON public.farmers FOR UPDATE TO authenticated USING (has_any_backoffice_role(auth.uid()));
CREATE POLICY "Backoffice can view farmers" ON public.farmers FOR SELECT TO authenticated USING (has_any_backoffice_role(auth.uid()));

-- 3. farmer_dependents
DROP POLICY IF EXISTS "Auth users can insert dependents" ON public.farmer_dependents;
DROP POLICY IF EXISTS "Auth users can update dependents" ON public.farmer_dependents;
DROP POLICY IF EXISTS "Auth users can view dependents" ON public.farmer_dependents;
CREATE POLICY "Backoffice can insert dependents" ON public.farmer_dependents FOR INSERT TO authenticated WITH CHECK (has_any_backoffice_role(auth.uid()));
CREATE POLICY "Backoffice can update dependents" ON public.farmer_dependents FOR UPDATE TO authenticated USING (has_any_backoffice_role(auth.uid()));
CREATE POLICY "Backoffice can view dependents" ON public.farmer_dependents FOR SELECT TO authenticated USING (has_any_backoffice_role(auth.uid()));

-- 4. farmer_transactions
DROP POLICY IF EXISTS "Auth users can insert transactions" ON public.farmer_transactions;
DROP POLICY IF EXISTS "Auth users can update transactions" ON public.farmer_transactions;
DROP POLICY IF EXISTS "Auth users can view transactions" ON public.farmer_transactions;
CREATE POLICY "Backoffice can insert transactions" ON public.farmer_transactions FOR INSERT TO authenticated WITH CHECK (has_any_backoffice_role(auth.uid()));
CREATE POLICY "Backoffice can update transactions" ON public.farmer_transactions FOR UPDATE TO authenticated USING (has_any_backoffice_role(auth.uid()));
CREATE POLICY "Backoffice can view transactions" ON public.farmer_transactions FOR SELECT TO authenticated USING (has_any_backoffice_role(auth.uid()));

-- 5. farmer_incentives
DROP POLICY IF EXISTS "Auth users can insert incentives" ON public.farmer_incentives;
DROP POLICY IF EXISTS "Auth users can update incentives" ON public.farmer_incentives;
DROP POLICY IF EXISTS "Auth users can view incentives" ON public.farmer_incentives;
CREATE POLICY "Backoffice can insert incentives" ON public.farmer_incentives FOR INSERT TO authenticated WITH CHECK (has_any_backoffice_role(auth.uid()));
CREATE POLICY "Backoffice can update incentives" ON public.farmer_incentives FOR UPDATE TO authenticated USING (has_any_backoffice_role(auth.uid()));
CREATE POLICY "Backoffice can view incentives" ON public.farmer_incentives FOR SELECT TO authenticated USING (has_any_backoffice_role(auth.uid()));

-- 6. farmer_parcels
DROP POLICY IF EXISTS "Auth users can insert parcels" ON public.farmer_parcels;
DROP POLICY IF EXISTS "Auth users can update parcels" ON public.farmer_parcels;
DROP POLICY IF EXISTS "Auth users can view parcels" ON public.farmer_parcels;
CREATE POLICY "Backoffice can insert parcels" ON public.farmer_parcels FOR INSERT TO authenticated WITH CHECK (has_any_backoffice_role(auth.uid()));
CREATE POLICY "Backoffice can update parcels" ON public.farmer_parcels FOR UPDATE TO authenticated USING (has_any_backoffice_role(auth.uid()));
CREATE POLICY "Backoffice can view parcels" ON public.farmer_parcels FOR SELECT TO authenticated USING (has_any_backoffice_role(auth.uid()));

-- 7. farmer_production
DROP POLICY IF EXISTS "Auth users can insert production" ON public.farmer_production;
DROP POLICY IF EXISTS "Auth users can update production" ON public.farmer_production;
DROP POLICY IF EXISTS "Auth users can view production" ON public.farmer_production;
CREATE POLICY "Backoffice can insert production" ON public.farmer_production FOR INSERT TO authenticated WITH CHECK (has_any_backoffice_role(auth.uid()));
CREATE POLICY "Backoffice can update production" ON public.farmer_production FOR UPDATE TO authenticated USING (has_any_backoffice_role(auth.uid()));
CREATE POLICY "Backoffice can view production" ON public.farmer_production FOR SELECT TO authenticated USING (has_any_backoffice_role(auth.uid()));

-- 8. farmer_production_phases
DROP POLICY IF EXISTS "Auth users can insert phases" ON public.farmer_production_phases;
DROP POLICY IF EXISTS "Auth users can update phases" ON public.farmer_production_phases;
DROP POLICY IF EXISTS "Auth users can view phases" ON public.farmer_production_phases;
CREATE POLICY "Backoffice can insert phases" ON public.farmer_production_phases FOR INSERT TO authenticated WITH CHECK (has_any_backoffice_role(auth.uid()));
CREATE POLICY "Backoffice can update phases" ON public.farmer_production_phases FOR UPDATE TO authenticated USING (has_any_backoffice_role(auth.uid()));
CREATE POLICY "Backoffice can view phases" ON public.farmer_production_phases FOR SELECT TO authenticated USING (has_any_backoffice_role(auth.uid()));

-- 9. farmer_documents
DROP POLICY IF EXISTS "Auth users can insert farmer documents" ON public.farmer_documents;
DROP POLICY IF EXISTS "Auth users can view farmer documents" ON public.farmer_documents;
CREATE POLICY "Backoffice can insert farmer documents" ON public.farmer_documents FOR INSERT TO authenticated WITH CHECK (has_any_backoffice_role(auth.uid()));
CREATE POLICY "Backoffice can view farmer documents" ON public.farmer_documents FOR SELECT TO authenticated USING (has_any_backoffice_role(auth.uid()));

-- 10. audit_logs (restrict SELECT to admins only)
DROP POLICY IF EXISTS "Auth users can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Auth users can insert audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Backoffice can insert audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (has_any_backoffice_role(auth.uid()));

-- 11. livestock
DROP POLICY IF EXISTS "Authenticated users can insert livestock" ON public.livestock;
DROP POLICY IF EXISTS "Authenticated users can update livestock" ON public.livestock;
DROP POLICY IF EXISTS "Authenticated users can view livestock" ON public.livestock;
CREATE POLICY "Backoffice can insert livestock" ON public.livestock FOR INSERT TO authenticated WITH CHECK (has_any_backoffice_role(auth.uid()));
CREATE POLICY "Backoffice can update livestock" ON public.livestock FOR UPDATE TO authenticated USING (has_any_backoffice_role(auth.uid()));
CREATE POLICY "Backoffice can view livestock" ON public.livestock FOR SELECT TO authenticated USING (has_any_backoffice_role(auth.uid()));

-- 12. livestock_health
DROP POLICY IF EXISTS "Authenticated users can insert livestock_health" ON public.livestock_health;
DROP POLICY IF EXISTS "Authenticated users can update livestock_health" ON public.livestock_health;
DROP POLICY IF EXISTS "Authenticated users can view livestock_health" ON public.livestock_health;
CREATE POLICY "Backoffice can insert livestock_health" ON public.livestock_health FOR INSERT TO authenticated WITH CHECK (has_any_backoffice_role(auth.uid()));
CREATE POLICY "Backoffice can update livestock_health" ON public.livestock_health FOR UPDATE TO authenticated USING (has_any_backoffice_role(auth.uid()));
CREATE POLICY "Backoffice can view livestock_health" ON public.livestock_health FOR SELECT TO authenticated USING (has_any_backoffice_role(auth.uid()));

-- 13. livestock_production
DROP POLICY IF EXISTS "Authenticated users can insert livestock_production" ON public.livestock_production;
DROP POLICY IF EXISTS "Authenticated users can update livestock_production" ON public.livestock_production;
DROP POLICY IF EXISTS "Authenticated users can view livestock_production" ON public.livestock_production;
CREATE POLICY "Backoffice can insert livestock_production" ON public.livestock_production FOR INSERT TO authenticated WITH CHECK (has_any_backoffice_role(auth.uid()));
CREATE POLICY "Backoffice can update livestock_production" ON public.livestock_production FOR UPDATE TO authenticated USING (has_any_backoffice_role(auth.uid()));
CREATE POLICY "Backoffice can view livestock_production" ON public.livestock_production FOR SELECT TO authenticated USING (has_any_backoffice_role(auth.uid()));