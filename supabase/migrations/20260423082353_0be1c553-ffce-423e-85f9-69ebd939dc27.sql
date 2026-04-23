-- 1) Tabela de histórico
CREATE TABLE public.farmer_balance_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_code text NOT NULL,
  field text NOT NULL CHECK (field IN ('valor_recebido','total_gasto','saldo_final')),
  old_value text,
  new_value text,
  delta numeric,
  source text NOT NULL DEFAULT 'edicao_manual',
  source_ref text,
  changed_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fbh_farmer_code ON public.farmer_balance_history(farmer_code, created_at DESC);
CREATE INDEX idx_fbh_field ON public.farmer_balance_history(farmer_code, field, created_at DESC);
CREATE INDEX idx_fbh_source ON public.farmer_balance_history(source, created_at DESC);

ALTER TABLE public.farmer_balance_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Backoffice can view balance history"
ON public.farmer_balance_history FOR SELECT
TO authenticated
USING (has_any_backoffice_role(auth.uid()));

CREATE POLICY "Admins can manage balance history"
ON public.farmer_balance_history FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- 2) Trigger function
CREATE OR REPLACE FUNCTION public.log_farmer_balance_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_source text;
  v_user uuid;
BEGIN
  -- Fonte: variável de sessão app.import_source ou 'edicao_manual'
  BEGIN
    v_source := current_setting('app.import_source', true);
  EXCEPTION WHEN OTHERS THEN
    v_source := NULL;
  END;
  IF v_source IS NULL OR v_source = '' THEN
    v_source := 'edicao_manual';
  END IF;

  v_user := auth.uid();

  IF NEW.valor_recebido IS DISTINCT FROM OLD.valor_recebido THEN
    INSERT INTO public.farmer_balance_history(farmer_code, field, old_value, new_value, delta, source, changed_by)
    VALUES (NEW.code, 'valor_recebido', OLD.valor_recebido, NEW.valor_recebido,
            public.parse_ptao_numeric(NEW.valor_recebido) - public.parse_ptao_numeric(OLD.valor_recebido),
            v_source, v_user);
  END IF;

  IF NEW.total_gasto IS DISTINCT FROM OLD.total_gasto THEN
    INSERT INTO public.farmer_balance_history(farmer_code, field, old_value, new_value, delta, source, changed_by)
    VALUES (NEW.code, 'total_gasto', OLD.total_gasto, NEW.total_gasto,
            public.parse_ptao_numeric(NEW.total_gasto) - public.parse_ptao_numeric(OLD.total_gasto),
            v_source, v_user);
  END IF;

  IF NEW.saldo_final IS DISTINCT FROM OLD.saldo_final THEN
    INSERT INTO public.farmer_balance_history(farmer_code, field, old_value, new_value, delta, source, changed_by)
    VALUES (NEW.code, 'saldo_final', OLD.saldo_final, NEW.saldo_final,
            public.parse_ptao_numeric(NEW.saldo_final) - public.parse_ptao_numeric(OLD.saldo_final),
            v_source, v_user);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_farmer_balance_change
AFTER UPDATE ON public.farmers
FOR EACH ROW EXECUTE FUNCTION public.log_farmer_balance_change();

-- 3) Seed: registo "snapshot inicial" para os agricultores que já têm valores (importação Unitel completa)
INSERT INTO public.farmer_balance_history(farmer_code, field, old_value, new_value, delta, source, notes)
SELECT code, 'valor_recebido', NULL, valor_recebido, public.parse_ptao_numeric(valor_recebido),
       'import_unitel_money_2026_04', 'Snapshot inicial após importação dos 10 ficheiros Unitel Money'
FROM public.farmers
WHERE valor_recebido IS NOT NULL AND public.parse_ptao_numeric(valor_recebido) > 0;

INSERT INTO public.farmer_balance_history(farmer_code, field, old_value, new_value, delta, source, notes)
SELECT code, 'total_gasto', NULL, total_gasto, public.parse_ptao_numeric(total_gasto),
       'recalc_inicial', 'Snapshot inicial do total gasto'
FROM public.farmers
WHERE total_gasto IS NOT NULL AND public.parse_ptao_numeric(total_gasto) > 0;

INSERT INTO public.farmer_balance_history(farmer_code, field, old_value, new_value, delta, source, notes)
SELECT code, 'saldo_final', NULL, saldo_final, public.parse_ptao_numeric(saldo_final),
       'recalc_inicial', 'Snapshot inicial do saldo final'
FROM public.farmers
WHERE saldo_final IS NOT NULL AND saldo_final <> '0,00';