
-- ====================================================================
-- MOSAP3 — Endurecimento pré-produção (Fase 1: Segurança RLS)
-- ====================================================================

-- 1) has_any_backoffice_role: enumerar explicitamente roles backoffice
CREATE OR REPLACE FUNCTION public.has_any_backoffice_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN (
        'admin','gestor_incentivos',
        'senior_agricultura','senior_monitoria','senior_agronegocio',
        'junior_agricultura','junior_monitoria','junior_agronegocio',
        'tecnico_extensionista'
      )
  )
$$;

-- 2) fingerprint_verifications
DROP POLICY IF EXISTS "Anon can read verifications" ON public.fingerprint_verifications;
DROP POLICY IF EXISTS "Auth users can view verifications" ON public.fingerprint_verifications;
CREATE POLICY "Backoffice can view verifications"
  ON public.fingerprint_verifications FOR SELECT
  TO authenticated
  USING (public.has_any_backoffice_role(auth.uid()));

-- 3) farmer_cards — remover anon SELECT (substituído por RPC)
DROP POLICY IF EXISTS "Public can verify by token" ON public.farmer_cards;

-- 4) farmer_nfc_tags
DROP POLICY IF EXISTS "Anon can lookup by nfc uid" ON public.farmer_nfc_tags;
DROP POLICY IF EXISTS "Auth users can view nfc tags" ON public.farmer_nfc_tags;
CREATE POLICY "Backoffice can view nfc tags"
  ON public.farmer_nfc_tags FOR SELECT
  TO authenticated
  USING (public.has_any_backoffice_role(auth.uid()));

-- 5) pos_sales / pos_sale_items
DROP POLICY IF EXISTS "Auth users can view sales" ON public.pos_sales;
DROP POLICY IF EXISTS "Auth users can view sale items" ON public.pos_sale_items;
CREATE POLICY "Backoffice or supplier can view sales"
  ON public.pos_sales FOR SELECT
  TO authenticated
  USING (
    public.has_any_backoffice_role(auth.uid())
    OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = pos_sales.supplier_id AND s.user_id = auth.uid())
  );
CREATE POLICY "Backoffice or supplier can view sale items"
  ON public.pos_sale_items FOR SELECT
  TO authenticated
  USING (
    public.has_any_backoffice_role(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.pos_sales s
      JOIN public.suppliers sup ON sup.id = s.supplier_id
      WHERE s.id = pos_sale_items.sale_id AND sup.user_id = auth.uid()
    )
  );

-- 6) credit_notes / credit_note_items
DROP POLICY IF EXISTS "Auth users can view credit notes" ON public.credit_notes;
DROP POLICY IF EXISTS "Auth users can view cn items" ON public.credit_note_items;
CREATE POLICY "Backoffice or supplier can view credit notes"
  ON public.credit_notes FOR SELECT
  TO authenticated
  USING (
    public.has_any_backoffice_role(auth.uid())
    OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = credit_notes.supplier_id AND s.user_id = auth.uid())
  );
CREATE POLICY "Backoffice or supplier can view cn items"
  ON public.credit_note_items FOR SELECT
  TO authenticated
  USING (
    public.has_any_backoffice_role(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.credit_notes cn
      JOIN public.suppliers s ON s.id = cn.supplier_id
      WHERE cn.id = credit_note_items.credit_note_id AND s.user_id = auth.uid()
    )
  );

-- 7) suppliers / supplier_stores
DROP POLICY IF EXISTS "Auth users can view suppliers" ON public.suppliers;
CREATE POLICY "Backoffice or self can view suppliers"
  ON public.suppliers FOR SELECT
  TO authenticated
  USING (public.has_any_backoffice_role(auth.uid()) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Auth users can view supplier stores" ON public.supplier_stores;
CREATE POLICY "Backoffice or owner can view supplier stores"
  ON public.supplier_stores FOR SELECT
  TO authenticated
  USING (
    public.has_any_backoffice_role(auth.uid())
    OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_stores.supplier_id AND s.user_id = auth.uid())
  );

-- 8) stock_movements
DROP POLICY IF EXISTS "Auth users can view stock movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Public can view stock movements" ON public.stock_movements;
CREATE POLICY "Backoffice or owner can view stock movements"
  ON public.stock_movements FOR SELECT
  TO authenticated
  USING (
    public.has_any_backoffice_role(auth.uid())
    OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = stock_movements.supplier_id AND s.user_id = auth.uid())
  );

-- 9) pos_payment_otps — supplier que criou pode consultar
CREATE POLICY "Suppliers can view own otps"
  ON public.pos_payment_otps FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = pos_payment_otps.supplier_id AND s.user_id = auth.uid())
  );

-- 10) RPC público: verificação de cartão por token
CREATE OR REPLACE FUNCTION public.public_verify_farmer_card(_token text)
RETURNS TABLE(
  farmer_name text,
  farmer_code text,
  status text,
  province text,
  has_credit boolean,
  card_status text,
  updated_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.full_name,
    f.code,
    COALESCE(f.status, 'Pendente'),
    f.province,
    COALESCE(NULLIF(regexp_replace(COALESCE(f.valor_recebido, '0'), '[^0-9,-]', '', 'g'), '')::numeric > 0, false),
    c.status,
    c.updated_at
  FROM public.farmer_cards c
  JOIN public.farmers f ON f.code = c.farmer_code
  WHERE c.card_token = _token
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.public_verify_farmer_card(text) FROM public;
GRANT EXECUTE ON FUNCTION public.public_verify_farmer_card(text) TO anon, authenticated;

-- 11) RPC público: lookup mínimo NFC
CREATE OR REPLACE FUNCTION public.public_lookup_nfc_tag(_uid text)
RETURNS TABLE(farmer_code text, is_active boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT farmer_code, is_active
  FROM public.farmer_nfc_tags
  WHERE nfc_uid = _uid AND is_active = true
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.public_lookup_nfc_tag(text) FROM public;
GRANT EXECUTE ON FUNCTION public.public_lookup_nfc_tag(text) TO anon, authenticated;
