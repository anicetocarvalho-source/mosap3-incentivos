-- 1. Coluna sim_status em farmers
ALTER TABLE public.farmers
  ADD COLUMN IF NOT EXISTS sim_status text NOT NULL DEFAULT 'Desconhecido',
  ADD COLUMN IF NOT EXISTS sim_status_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS sim_status_source text;

-- Constraint de valores válidos
ALTER TABLE public.farmers
  DROP CONSTRAINT IF EXISTS farmers_sim_status_check;
ALTER TABLE public.farmers
  ADD CONSTRAINT farmers_sim_status_check
  CHECK (sim_status IN ('Activo', 'Removido', 'Barrado', 'Pré desactivado', 'Desconhecido'));

CREATE INDEX IF NOT EXISTS idx_farmers_sim_status ON public.farmers(sim_status);

-- 2. Tabela de histórico
CREATE TABLE IF NOT EXISTS public.sim_status_history (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_code text NOT NULL,
  phone text,
  old_status text,
  new_status text NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  notes text,
  changed_by uuid,
  changed_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sim_status_history_farmer ON public.sim_status_history(farmer_code);
CREATE INDEX IF NOT EXISTS idx_sim_status_history_created ON public.sim_status_history(created_at DESC);

ALTER TABLE public.sim_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and incentive managers can view sim history"
  ON public.sim_status_history FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'gestor_incentivos'::app_role));

CREATE POLICY "Admins and incentive managers can insert sim history"
  ON public.sim_status_history FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'gestor_incentivos'::app_role));

CREATE POLICY "Admins can delete sim history"
  ON public.sim_status_history FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));

-- 3. Trigger que regista alterações e notifica
CREATE OR REPLACE FUNCTION public.on_sim_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid;
  v_user_name text;
  v_source text;
BEGIN
  IF OLD.sim_status IS DISTINCT FROM NEW.sim_status THEN
    v_user := auth.uid();
    SELECT full_name INTO v_user_name FROM public.profiles WHERE user_id = v_user;
    v_source := COALESCE(NEW.sim_status_source, 'manual');

    INSERT INTO public.sim_status_history(
      farmer_code, phone, old_status, new_status, source, changed_by, changed_by_name
    ) VALUES (
      NEW.code, NEW.phone, OLD.sim_status, NEW.sim_status, v_source, v_user, v_user_name
    );

    NEW.sim_status_updated_at := now();

    PERFORM notify_all_users(
      'Cartão SIM Alterado',
      'O agricultor ' || NEW.full_name || ' (' || COALESCE(NEW.phone, NEW.code) || ') passou de "' || COALESCE(OLD.sim_status,'—') || '" para "' || NEW.sim_status || '".',
      'cartoes_sim',
      'farmer',
      NEW.code
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_sim_status_changed ON public.farmers;
CREATE TRIGGER trg_on_sim_status_changed
  BEFORE UPDATE OF sim_status ON public.farmers
  FOR EACH ROW
  EXECUTE FUNCTION public.on_sim_status_changed();