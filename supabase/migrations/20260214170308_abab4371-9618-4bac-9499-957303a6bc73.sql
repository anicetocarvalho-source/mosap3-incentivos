
-- 1. Parcels table
CREATE TABLE public.farmer_parcels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farmer_code TEXT NOT NULL REFERENCES public.farmers(code) ON DELETE CASCADE,
  parcel_code TEXT NOT NULL,
  culture TEXT NOT NULL,
  area TEXT NOT NULL,
  lat TEXT,
  lon TEXT,
  status TEXT NOT NULL DEFAULT 'Pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.farmer_parcels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can view parcels" ON public.farmer_parcels FOR SELECT USING (true);
CREATE POLICY "Auth users can insert parcels" ON public.farmer_parcels FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth users can update parcels" ON public.farmer_parcels FOR UPDATE USING (true);
CREATE POLICY "Admins can delete parcels" ON public.farmer_parcels FOR DELETE USING (is_admin(auth.uid()));

CREATE TRIGGER update_farmer_parcels_updated_at BEFORE UPDATE ON public.farmer_parcels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Production table
CREATE TABLE public.farmer_production (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farmer_code TEXT NOT NULL REFERENCES public.farmers(code) ON DELETE CASCADE,
  production_code TEXT NOT NULL,
  culture TEXT NOT NULL,
  area TEXT,
  planted_date TEXT,
  expected_harvest TEXT,
  estimated_yield TEXT,
  actual_yield TEXT,
  status TEXT NOT NULL DEFAULT 'Semeada',
  current_phase TEXT,
  technician TEXT,
  escola TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.farmer_production ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can view production" ON public.farmer_production FOR SELECT USING (true);
CREATE POLICY "Auth users can insert production" ON public.farmer_production FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth users can update production" ON public.farmer_production FOR UPDATE USING (true);
CREATE POLICY "Admins can delete production" ON public.farmer_production FOR DELETE USING (is_admin(auth.uid()));

CREATE TRIGGER update_farmer_production_updated_at BEFORE UPDATE ON public.farmer_production
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Production phases table
CREATE TABLE public.farmer_production_phases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_id UUID NOT NULL REFERENCES public.farmer_production(id) ON DELETE CASCADE,
  phase TEXT NOT NULL,
  phase_date TEXT,
  notes TEXT,
  tech_note TEXT,
  photos TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.farmer_production_phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can view phases" ON public.farmer_production_phases FOR SELECT USING (true);
CREATE POLICY "Auth users can insert phases" ON public.farmer_production_phases FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth users can update phases" ON public.farmer_production_phases FOR UPDATE USING (true);
CREATE POLICY "Admins can delete phases" ON public.farmer_production_phases FOR DELETE USING (is_admin(auth.uid()));

-- 4. Incentives table
CREATE TABLE public.farmer_incentives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farmer_code TEXT NOT NULL REFERENCES public.farmers(code) ON DELETE CASCADE,
  incentive_code TEXT NOT NULL,
  type TEXT NOT NULL,
  amount TEXT NOT NULL,
  method TEXT DEFAULT 'Unitel Money',
  status TEXT NOT NULL DEFAULT 'Pendente',
  incentive_date TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.farmer_incentives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can view incentives" ON public.farmer_incentives FOR SELECT USING (true);
CREATE POLICY "Auth users can insert incentives" ON public.farmer_incentives FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth users can update incentives" ON public.farmer_incentives FOR UPDATE USING (true);
CREATE POLICY "Admins can delete incentives" ON public.farmer_incentives FOR DELETE USING (is_admin(auth.uid()));

-- 5. Transactions table
CREATE TABLE public.farmer_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farmer_code TEXT NOT NULL REFERENCES public.farmers(code) ON DELETE CASCADE,
  product TEXT NOT NULL,
  empresa TEXT NOT NULL,
  valor TEXT NOT NULL,
  transaction_date TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.farmer_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can view transactions" ON public.farmer_transactions FOR SELECT USING (true);
CREATE POLICY "Auth users can insert transactions" ON public.farmer_transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth users can update transactions" ON public.farmer_transactions FOR UPDATE USING (true);
CREATE POLICY "Admins can delete transactions" ON public.farmer_transactions FOR DELETE USING (is_admin(auth.uid()));

-- 6. Dependents table
CREATE TABLE public.farmer_dependents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farmer_code TEXT NOT NULL REFERENCES public.farmers(code) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  gender TEXT,
  birth_date TEXT,
  age INTEGER,
  education TEXT,
  occupation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.farmer_dependents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can view dependents" ON public.farmer_dependents FOR SELECT USING (true);
CREATE POLICY "Auth users can insert dependents" ON public.farmer_dependents FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth users can update dependents" ON public.farmer_dependents FOR UPDATE USING (true);
CREATE POLICY "Admins can delete dependents" ON public.farmer_dependents FOR DELETE USING (is_admin(auth.uid()));

-- 7. Financial summary on farmers table
ALTER TABLE public.farmers
  ADD COLUMN IF NOT EXISTS valor_recebido TEXT DEFAULT '0,00',
  ADD COLUMN IF NOT EXISTS total_gasto TEXT DEFAULT '0,00',
  ADD COLUMN IF NOT EXISTS saldo_final TEXT DEFAULT '0,00';
