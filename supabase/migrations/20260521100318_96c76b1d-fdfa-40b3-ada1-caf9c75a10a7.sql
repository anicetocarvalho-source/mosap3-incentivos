
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS activated_by uuid,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS deactivated_by uuid,
  ADD COLUMN IF NOT EXISTS deactivation_reason text;

CREATE INDEX IF NOT EXISTS idx_suppliers_status ON public.suppliers(status);

CREATE OR REPLACE FUNCTION public.admin_activate_supplier(_supplier_id uuid, _reason text DEFAULT NULL)
RETURNS public.suppliers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_user_name text;
  v_row public.suppliers;
  v_prev_status text;
BEGIN
  IF NOT public.is_admin(v_user) THEN
    RAISE EXCEPTION 'Apenas administradores podem ativar fornecedores';
  END IF;

  SELECT status INTO v_prev_status FROM public.suppliers WHERE id = _supplier_id;
  IF v_prev_status IS NULL THEN
    RAISE EXCEPTION 'Fornecedor não encontrado';
  END IF;

  UPDATE public.suppliers
     SET status = 'Ativo',
         activated_at = now(),
         activated_by = v_user,
         deactivated_at = NULL,
         deactivated_by = NULL,
         deactivation_reason = NULL,
         updated_at = now()
   WHERE id = _supplier_id
  RETURNING * INTO v_row;

  SELECT full_name INTO v_user_name FROM public.profiles WHERE user_id = v_user;

  INSERT INTO public.audit_logs (action, entity_type, entity_id, user_id, user_name, details)
  VALUES ('supplier_activated', 'supplier', _supplier_id::text, v_user, COALESCE(v_user_name,'admin'),
          jsonb_build_object('previous_status', v_prev_status, 'new_status', 'Ativo', 'reason', _reason, 'supplier_name', v_row.name));

  PERFORM public.notify_all_users(
    'Fornecedor Ativado',
    'O fornecedor "' || v_row.name || '" foi ativado.',
    'fornecedores', 'supplier', _supplier_id::text
  );

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_deactivate_supplier(_supplier_id uuid, _reason text DEFAULT NULL)
RETURNS public.suppliers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_user_name text;
  v_row public.suppliers;
  v_prev_status text;
BEGIN
  IF NOT public.is_admin(v_user) THEN
    RAISE EXCEPTION 'Apenas administradores podem desativar fornecedores';
  END IF;

  SELECT status INTO v_prev_status FROM public.suppliers WHERE id = _supplier_id;
  IF v_prev_status IS NULL THEN
    RAISE EXCEPTION 'Fornecedor não encontrado';
  END IF;

  UPDATE public.suppliers
     SET status = 'Inativo',
         deactivated_at = now(),
         deactivated_by = v_user,
         deactivation_reason = _reason,
         updated_at = now()
   WHERE id = _supplier_id
  RETURNING * INTO v_row;

  SELECT full_name INTO v_user_name FROM public.profiles WHERE user_id = v_user;

  INSERT INTO public.audit_logs (action, entity_type, entity_id, user_id, user_name, details)
  VALUES ('supplier_deactivated', 'supplier', _supplier_id::text, v_user, COALESCE(v_user_name,'admin'),
          jsonb_build_object('previous_status', v_prev_status, 'new_status', 'Inativo', 'reason', _reason, 'supplier_name', v_row.name));

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_activate_supplier(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_deactivate_supplier(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_activate_supplier(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_deactivate_supplier(uuid, text) TO authenticated;
