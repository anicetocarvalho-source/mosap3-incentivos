-- 1) Recalcular total_gasto a partir de farmer_transactions e saldo_final = valor_recebido - total_gasto
--    valor_recebido fica intacto (será carregado por importação por telefone).

UPDATE public.farmers f
SET
  total_gasto = to_char(
    COALESCE((
      SELECT SUM(public.parse_ptao_numeric(t.valor))
      FROM public.farmer_transactions t
      WHERE t.farmer_code = f.code
    ), 0),
    'FM999G999G990D00'
  ),
  saldo_final = to_char(
    public.parse_ptao_numeric(f.valor_recebido)
    - COALESCE((
        SELECT SUM(public.parse_ptao_numeric(t.valor))
        FROM public.farmer_transactions t
        WHERE t.farmer_code = f.code
      ), 0),
    'FM999G999G990D00'
  );

-- 2) Função genérica para recalcular os totais de UM agricultor.
CREATE OR REPLACE FUNCTION public.recalc_farmer_totals(_farmer_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gasto numeric := 0;
  v_recebido numeric := 0;
BEGIN
  IF _farmer_code IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(public.parse_ptao_numeric(valor)), 0)
  INTO v_gasto
  FROM public.farmer_transactions
  WHERE farmer_code = _farmer_code;

  SELECT public.parse_ptao_numeric(valor_recebido)
  INTO v_recebido
  FROM public.farmers
  WHERE code = _farmer_code;

  UPDATE public.farmers
  SET
    total_gasto = to_char(v_gasto, 'FM999G999G990D00'),
    saldo_final = to_char(COALESCE(v_recebido, 0) - v_gasto, 'FM999G999G990D00')
  WHERE code = _farmer_code;
END;
$$;

-- 3) Trigger sobre farmer_transactions: recalcula totais do agricultor afectado.
CREATE OR REPLACE FUNCTION public.trg_recalc_on_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_farmer_totals(OLD.farmer_code);
    RETURN OLD;
  END IF;

  PERFORM public.recalc_farmer_totals(NEW.farmer_code);
  -- Se o farmer_code mudou num UPDATE, recalcular também o anterior.
  IF TG_OP = 'UPDATE' AND OLD.farmer_code IS DISTINCT FROM NEW.farmer_code THEN
    PERFORM public.recalc_farmer_totals(OLD.farmer_code);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS farmer_transactions_recalc ON public.farmer_transactions;
CREATE TRIGGER farmer_transactions_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.farmer_transactions
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_on_transaction();

-- 4) Trigger sobre farmers: se valor_recebido for actualizado, recalcular saldo_final automaticamente.
CREATE OR REPLACE FUNCTION public.trg_recalc_on_farmer_recebido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gasto numeric := 0;
BEGIN
  IF NEW.valor_recebido IS DISTINCT FROM OLD.valor_recebido THEN
    SELECT COALESCE(SUM(public.parse_ptao_numeric(valor)), 0)
    INTO v_gasto
    FROM public.farmer_transactions
    WHERE farmer_code = NEW.code;

    NEW.saldo_final := to_char(
      public.parse_ptao_numeric(NEW.valor_recebido) - v_gasto,
      'FM999G999G990D00'
    );
    NEW.total_gasto := to_char(v_gasto, 'FM999G999G990D00');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS farmers_recalc_on_recebido ON public.farmers;
CREATE TRIGGER farmers_recalc_on_recebido
BEFORE UPDATE OF valor_recebido ON public.farmers
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_on_farmer_recebido();