-- ============================================================
-- PERFORMANCE: indexes + batch RPC for farmer cards
-- ============================================================

-- Trigram extension for fast ILIKE '%term%' searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Farmers ----------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_farmers_status            ON public.farmers (status);
CREATE INDEX IF NOT EXISTS idx_farmers_province          ON public.farmers (province);
CREATE INDEX IF NOT EXISTS idx_farmers_municipality      ON public.farmers (municipality);
CREATE INDEX IF NOT EXISTS idx_farmers_school            ON public.farmers (school);
CREATE INDEX IF NOT EXISTS idx_farmers_created_at_desc   ON public.farmers (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_farmers_patec             ON public.farmers (patec);
CREATE INDEX IF NOT EXISTS idx_farmers_sim_status        ON public.farmers (sim_status);
CREATE INDEX IF NOT EXISTS idx_farmers_full_name_trgm    ON public.farmers USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_farmers_code_trgm         ON public.farmers USING gin (code gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_farmers_phone_trgm        ON public.farmers USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_farmers_bi_trgm           ON public.farmers USING gin (bi gin_trgm_ops);

-- Transactions -----------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ftx_created_at_desc       ON public.farmer_transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ftx_farmer_code           ON public.farmer_transactions (farmer_code);
CREATE INDEX IF NOT EXISTS idx_ftx_empresa               ON public.farmer_transactions (empresa);
CREATE INDEX IF NOT EXISTS idx_ftx_product_trgm          ON public.farmer_transactions USING gin (product gin_trgm_ops);

-- POS sales --------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_pos_sales_created_at_desc ON public.pos_sales (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_sales_supplier        ON public.pos_sales (supplier_id);
CREATE INDEX IF NOT EXISTS idx_pos_sales_farmer_code     ON public.pos_sales (farmer_code);
CREATE INDEX IF NOT EXISTS idx_pos_sales_payment_status  ON public.pos_sales (payment_status);

-- Farmer cards / logs ----------------------------------------
CREATE INDEX IF NOT EXISTS idx_farmer_cards_farmer_code  ON public.farmer_cards (farmer_code);
CREATE INDEX IF NOT EXISTS idx_farmer_cards_status       ON public.farmer_cards (status);
CREATE INDEX IF NOT EXISTS idx_farmer_card_logs_code     ON public.farmer_card_logs (farmer_code, created_at DESC);

-- Audit logs -------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created ON public.audit_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity         ON public.audit_logs (entity_type, entity_id);

-- Notifications ----------------------------------------------
CREATE INDEX IF NOT EXISTS idx_notifications_user_read   ON public.notifications (user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_farmer_notifications_code ON public.farmer_notifications (farmer_code, created_at DESC);

-- Other useful -----------------------------------------------
CREATE INDEX IF NOT EXISTS idx_farmer_parcels_code       ON public.farmer_parcels (farmer_code);
CREATE INDEX IF NOT EXISTS idx_farmer_production_code    ON public.farmer_production (farmer_code);
CREATE INDEX IF NOT EXISTS idx_farmer_incentives_code    ON public.farmer_incentives (farmer_code);
CREATE INDEX IF NOT EXISTS idx_livestock_farmer_id       ON public.livestock (farmer_id);

-- ============================================================
-- BATCH RPC: gerar cartões de ID para vários agricultores
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_farmer_cards_batch(
  _codes text[]
) RETURNS TABLE(farmer_code text, card_token text, was_new boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF NOT has_any_backoffice_role(v_user) THEN
    RAISE EXCEPTION 'Sem permissão para gerar cartões';
  END IF;

  -- Atualiza cartões já existentes (não revogados)
  UPDATE public.farmer_cards c
     SET status = 'Gerado',
         generated_at = now(),
         generated_by = v_user,
         updated_at = now()
   WHERE c.farmer_code = ANY(_codes)
     AND c.status <> 'Revogado';

  -- Cria cartões novos para códigos sem cartão activo
  INSERT INTO public.farmer_cards (farmer_code, status, generated_at, generated_by)
  SELECT u.code, 'Gerado', now(), v_user
    FROM unnest(_codes) AS u(code)
   WHERE NOT EXISTS (
     SELECT 1 FROM public.farmer_cards c
      WHERE c.farmer_code = u.code AND c.status <> 'Revogado'
   );

  -- Log em lote
  INSERT INTO public.farmer_card_logs (farmer_code, action, performed_by, details)
  SELECT u.code, 'gerado', v_user, jsonb_build_object('batch', true)
    FROM unnest(_codes) AS u(code);

  RETURN QUERY
  SELECT c.farmer_code, c.card_token,
         (c.generated_at >= now() - interval '5 seconds' AND c.created_at = c.updated_at) AS was_new
    FROM public.farmer_cards c
   WHERE c.farmer_code = ANY(_codes)
     AND c.status <> 'Revogado';
END;
$$;