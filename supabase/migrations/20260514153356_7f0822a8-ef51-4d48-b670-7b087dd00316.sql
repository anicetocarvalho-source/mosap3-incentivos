-- 1) Tabela de notificações ao agricultor
CREATE TABLE IF NOT EXISTS public.farmer_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_code text NOT NULL,
  phone text,
  channel text NOT NULL CHECK (channel IN ('sms','in_app','whatsapp')),
  title text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pendente_envio' CHECK (status IN ('pendente_envio','enviada','falhada','sem_gateway','lida')),
  sim_status text,
  trigger_event text,
  source text,
  error_message text,
  sent_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_farmer_notif_farmer ON public.farmer_notifications(farmer_code);
CREATE INDEX IF NOT EXISTS idx_farmer_notif_created ON public.farmer_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_farmer_notif_status ON public.farmer_notifications(status);

ALTER TABLE public.farmer_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Backoffice can view farmer notifications"
  ON public.farmer_notifications FOR SELECT TO authenticated
  USING (has_any_backoffice_role(auth.uid()));

CREATE POLICY "Backoffice can insert farmer notifications"
  ON public.farmer_notifications FOR INSERT TO authenticated
  WITH CHECK (has_any_backoffice_role(auth.uid()));

CREATE POLICY "Admins can update farmer notifications"
  ON public.farmer_notifications FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(),'gestor_incentivos'::app_role));

CREATE POLICY "Admins can delete farmer notifications"
  ON public.farmer_notifications FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));

-- 2) RPC com cooldown 24h
CREATE OR REPLACE FUNCTION public.notify_farmer_sim_blocked(
  _farmer_code text,
  _phone text,
  _farmer_name text,
  _sim_status text,
  _event text,
  _source text DEFAULT 'pos'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent_count int := 0;
  v_title text;
  v_body text;
  v_user uuid;
BEGIN
  IF _farmer_code IS NULL OR _sim_status IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason','dados_invalidos');
  END IF;

  v_user := auth.uid();

  -- Cooldown: 24h por agricultor + sim_status (qualquer canal)
  SELECT COUNT(*) INTO v_recent_count
  FROM public.farmer_notifications
  WHERE farmer_code = _farmer_code
    AND sim_status = _sim_status
    AND created_at > now() - interval '24 hours';

  IF v_recent_count > 0 THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason','cooldown_24h');
  END IF;

  v_title := 'Cartão SIM ' || _sim_status;
  v_body := 'Caro(a) ' || COALESCE(_farmer_name,'agricultor') ||
            ', o seu cartão SIM encontra-se "' || _sim_status ||
            '" e por isso as suas compras MOSAP3Pay estão bloqueadas. ' ||
            'Por favor regularize a situação junto do operador Unitel.';

  -- SMS pendente de envio
  INSERT INTO public.farmer_notifications(
    farmer_code, phone, channel, title, body, status,
    sim_status, trigger_event, source, created_by
  ) VALUES (
    _farmer_code, _phone, 'sms', v_title, v_body,
    CASE WHEN _phone IS NULL OR btrim(_phone) = '' THEN 'falhada' ELSE 'pendente_envio' END,
    _sim_status, _event, _source, v_user
  );

  -- Registo in-app (visível no perfil do agricultor)
  INSERT INTO public.farmer_notifications(
    farmer_code, phone, channel, title, body, status,
    sim_status, trigger_event, source, created_by
  ) VALUES (
    _farmer_code, _phone, 'in_app', v_title, v_body, 'enviada',
    _sim_status, _event, _source, v_user
  );

  -- Notificar gestores via sino
  PERFORM notify_all_users(
    'Agricultor notificado — SIM ' || _sim_status,
    'O agricultor ' || COALESCE(_farmer_name, _farmer_code) ||
      ' (' || COALESCE(_phone,'sem telefone') || ') foi notificado [' || _event || '].',
    'cartoes_sim',
    'farmer',
    _farmer_code
  );

  RETURN jsonb_build_object('ok', true, 'skipped', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_farmer_sim_blocked(text,text,text,text,text,text) TO authenticated;

-- 3) Estender trigger on_sim_status_changed para notificar agricultor
CREATE OR REPLACE FUNCTION public.on_sim_status_changed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    -- Notificar agricultor quando passa a Barrado/Removido
    IF NEW.sim_status IN ('Barrado','Removido') THEN
      PERFORM public.notify_farmer_sim_blocked(
        NEW.code, NEW.phone, NEW.full_name, NEW.sim_status,
        'mudanca_estado_' || lower(v_source), v_source
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;