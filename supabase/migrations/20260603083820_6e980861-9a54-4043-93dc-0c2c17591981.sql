
-- Required for PIN hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- =========================================================================
-- 1. supplier_sellers — vendedores criados pelo fornecedor (user + PIN)
-- =========================================================================
CREATE TABLE public.supplier_sellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  username text NOT NULL,
  pin_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX supplier_sellers_uniq_username ON public.supplier_sellers (supplier_id, lower(username));
CREATE INDEX supplier_sellers_supplier_idx ON public.supplier_sellers (supplier_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_sellers TO authenticated;
GRANT ALL ON public.supplier_sellers TO service_role;

ALTER TABLE public.supplier_sellers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Supplier owner manages own sellers"
  ON public.supplier_sellers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_sellers.supplier_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_sellers.supplier_id AND s.user_id = auth.uid()));

CREATE POLICY "Backoffice can view sellers"
  ON public.supplier_sellers FOR SELECT TO authenticated
  USING (public.has_any_backoffice_role(auth.uid()));

CREATE POLICY "Admins can manage sellers"
  ON public.supplier_sellers FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_supplier_sellers_updated
  BEFORE UPDATE ON public.supplier_sellers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- 2. pos_shifts — turnos abertos/fechados por vendedor
-- =========================================================================
CREATE TABLE public.pos_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES public.supplier_sellers(id) ON DELETE RESTRICT,
  pos_id uuid REFERENCES public.supplier_pos(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','fechado')),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  opened_by uuid,
  closed_by uuid,
  opening_note text,
  closing_note text,
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pos_shifts_supplier_idx ON public.pos_shifts (supplier_id);
CREATE INDEX pos_shifts_seller_idx ON public.pos_shifts (seller_id);
CREATE INDEX pos_shifts_opened_idx ON public.pos_shifts (opened_at);
-- No máximo um turno aberto por (seller_id, pos_id)
CREATE UNIQUE INDEX pos_shifts_one_open_per_seller_pos
  ON public.pos_shifts (seller_id, COALESCE(pos_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status = 'aberto';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pos_shifts TO authenticated;
GRANT ALL ON public.pos_shifts TO service_role;

ALTER TABLE public.pos_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Supplier owner manages own shifts"
  ON public.pos_shifts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = pos_shifts.supplier_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = pos_shifts.supplier_id AND s.user_id = auth.uid()));

CREATE POLICY "Backoffice can view shifts"
  ON public.pos_shifts FOR SELECT TO authenticated
  USING (public.has_any_backoffice_role(auth.uid()));

CREATE POLICY "Admins can manage shifts"
  ON public.pos_shifts FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_pos_shifts_updated
  BEFORE UPDATE ON public.pos_shifts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- 3. pos_sales — adicionar rastreabilidade do vendedor
-- =========================================================================
ALTER TABLE public.pos_sales
  ADD COLUMN seller_id uuid REFERENCES public.supplier_sellers(id) ON DELETE SET NULL,
  ADD COLUMN shift_id uuid REFERENCES public.pos_shifts(id) ON DELETE SET NULL,
  ADD COLUMN seller_name text;

CREATE INDEX pos_sales_seller_idx ON public.pos_sales (seller_id);
CREATE INDEX pos_sales_shift_idx ON public.pos_sales (shift_id);

-- =========================================================================
-- 4. RPCs
-- =========================================================================

-- Cria/atualiza um vendedor (dono do fornecedor). PIN é guardado como bcrypt.
CREATE OR REPLACE FUNCTION public.supplier_seller_upsert(
  _id uuid,
  _supplier_id uuid,
  _full_name text,
  _username text,
  _pin text,
  _is_active boolean DEFAULT true
) RETURNS public.supplier_sellers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row public.supplier_sellers;
  v_owner boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.suppliers WHERE id = _supplier_id AND user_id = v_user) INTO v_owner;
  IF NOT v_owner AND NOT public.is_admin(v_user) THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  IF _full_name IS NULL OR btrim(_full_name) = '' THEN RAISE EXCEPTION 'Nome obrigatório'; END IF;
  IF _username IS NULL OR length(btrim(_username)) < 3 THEN RAISE EXCEPTION 'Username inválido (mín. 3)'; END IF;
  IF _username !~ '^[a-zA-Z0-9._-]{3,30}$' THEN RAISE EXCEPTION 'Username inválido (a-z 0-9 . _ -)'; END IF;

  IF _id IS NULL THEN
    IF _pin IS NULL OR _pin !~ '^\d{4,6}$' THEN RAISE EXCEPTION 'PIN deve ter 4 a 6 dígitos'; END IF;
    INSERT INTO public.supplier_sellers (supplier_id, full_name, username, pin_hash, is_active, created_by)
    VALUES (_supplier_id, btrim(_full_name), lower(btrim(_username)),
            crypt(_pin, gen_salt('bf', 10)), COALESCE(_is_active, true), v_user)
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.supplier_sellers
       SET full_name = btrim(_full_name),
           username  = lower(btrim(_username)),
           is_active = COALESCE(_is_active, is_active),
           pin_hash  = CASE WHEN _pin IS NOT NULL AND _pin <> ''
                              THEN crypt(_pin, gen_salt('bf', 10))
                            ELSE pin_hash END,
           failed_attempts = CASE WHEN _pin IS NOT NULL AND _pin <> '' THEN 0 ELSE failed_attempts END,
           locked_until    = CASE WHEN _pin IS NOT NULL AND _pin <> '' THEN NULL ELSE locked_until END,
           updated_at = now()
     WHERE id = _id
     RETURNING * INTO v_row;
    IF v_row.id IS NULL THEN RAISE EXCEPTION 'Vendedor não encontrado'; END IF;
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.supplier_seller_upsert(uuid,uuid,text,text,text,boolean) TO authenticated;

-- Login do vendedor por username + PIN (devolve o seller_id). Lock após 5 falhas / 15min.
CREATE OR REPLACE FUNCTION public.supplier_seller_login(
  _supplier_id uuid,
  _username text,
  _pin text
) RETURNS TABLE(seller_id uuid, full_name text, username text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_owner boolean;
  v_row public.supplier_sellers;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.suppliers WHERE id = _supplier_id AND user_id = v_user) INTO v_owner;
  IF NOT v_owner AND NOT public.is_admin(v_user) THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  SELECT * INTO v_row FROM public.supplier_sellers
    WHERE supplier_id = _supplier_id AND username = lower(btrim(_username))
    LIMIT 1;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Credenciais inválidas'; END IF;
  IF NOT v_row.is_active THEN RAISE EXCEPTION 'Vendedor inativo'; END IF;
  IF v_row.locked_until IS NOT NULL AND v_row.locked_until > now() THEN
    RAISE EXCEPTION 'Conta bloqueada até %', to_char(v_row.locked_until, 'HH24:MI');
  END IF;

  IF v_row.pin_hash = crypt(COALESCE(_pin,''), v_row.pin_hash) THEN
    UPDATE public.supplier_sellers
       SET failed_attempts = 0, locked_until = NULL, updated_at = now()
     WHERE id = v_row.id;
    RETURN QUERY SELECT v_row.id, v_row.full_name, v_row.username;
  ELSE
    UPDATE public.supplier_sellers
       SET failed_attempts = failed_attempts + 1,
           locked_until = CASE WHEN failed_attempts + 1 >= 5
                                 THEN now() + interval '15 minutes' ELSE locked_until END,
           updated_at = now()
     WHERE id = v_row.id;
    RAISE EXCEPTION 'Credenciais inválidas';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.supplier_seller_login(uuid,text,text) TO authenticated;

-- Abrir turno
CREATE OR REPLACE FUNCTION public.open_pos_shift(
  _seller_id uuid,
  _pos_id uuid,
  _opening_note text DEFAULT NULL
) RETURNS public.pos_shifts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_supplier_id uuid;
  v_owner boolean;
  v_row public.pos_shifts;
BEGIN
  SELECT supplier_id INTO v_supplier_id FROM public.supplier_sellers WHERE id = _seller_id;
  IF v_supplier_id IS NULL THEN RAISE EXCEPTION 'Vendedor inexistente'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.suppliers WHERE id = v_supplier_id AND user_id = v_user) INTO v_owner;
  IF NOT v_owner AND NOT public.is_admin(v_user) THEN RAISE EXCEPTION 'Não autorizado'; END IF;

  INSERT INTO public.pos_shifts (supplier_id, seller_id, pos_id, status, opened_by, opening_note)
  VALUES (v_supplier_id, _seller_id, _pos_id, 'aberto', v_user, _opening_note)
  RETURNING * INTO v_row;

  INSERT INTO public.audit_logs (action, entity_type, entity_id, user_id, details)
  VALUES ('pos_shift_opened', 'pos_shift', v_row.id::text, v_user,
          jsonb_build_object('seller_id', _seller_id, 'pos_id', _pos_id));

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_pos_shift(uuid,uuid,text) TO authenticated;

-- Fechar turno (consolida totais)
CREATE OR REPLACE FUNCTION public.close_pos_shift(
  _shift_id uuid,
  _closing_note text DEFAULT NULL
) RETURNS public.pos_shifts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row public.pos_shifts;
  v_owner boolean;
  v_totals jsonb;
BEGIN
  SELECT * INTO v_row FROM public.pos_shifts WHERE id = _shift_id;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Turno inexistente'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.suppliers WHERE id = v_row.supplier_id AND user_id = v_user) INTO v_owner;
  IF NOT v_owner AND NOT public.is_admin(v_user) THEN RAISE EXCEPTION 'Não autorizado'; END IF;
  IF v_row.status = 'fechado' THEN RAISE EXCEPTION 'Turno já fechado'; END IF;

  SELECT jsonb_build_object(
    'count', COUNT(*),
    'subtotal', COALESCE(SUM(subtotal), 0),
    'iva_total', COALESCE(SUM(iva_total), 0),
    'total', COALESCE(SUM(total), 0),
    'by_method', COALESCE(jsonb_object_agg(payment_method, method_total) FILTER (WHERE payment_method IS NOT NULL), '{}'::jsonb)
  )
  INTO v_totals
  FROM (
    SELECT payment_method, SUM(total) AS method_total, subtotal, iva_total, total
    FROM public.pos_sales
    WHERE shift_id = _shift_id
    GROUP BY payment_method, subtotal, iva_total, total
  ) s;

  UPDATE public.pos_shifts
     SET status = 'fechado', closed_at = now(), closed_by = v_user,
         closing_note = _closing_note, totals = COALESCE(v_totals, '{}'::jsonb),
         updated_at = now()
   WHERE id = _shift_id
   RETURNING * INTO v_row;

  INSERT INTO public.audit_logs (action, entity_type, entity_id, user_id, details)
  VALUES ('pos_shift_closed', 'pos_shift', _shift_id::text, v_user, v_row.totals);

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_pos_shift(uuid,text) TO authenticated;
