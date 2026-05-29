
-- Function to dispatch in-app notifications for high-severity price alerts
-- Deduplicates by product+supplier within last 24h to avoid spam
CREATE OR REPLACE FUNCTION public.dispatch_price_alert_notifications(
  p_min_suppliers integer DEFAULT 3,
  p_high_pct numeric DEFAULT 40,
  p_medium_pct numeric DEFAULT 25,
  p_dedupe_hours integer DEFAULT 24
)
RETURNS TABLE(notifications_created integer, alerts_evaluated integer, alerts_skipped integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alert record;
  v_user record;
  v_entity_id text;
  v_exists boolean;
  v_created integer := 0;
  v_evaluated integer := 0;
  v_skipped integer := 0;
  v_title text;
  v_body text;
BEGIN
  -- Only backoffice users (admin / gestor_incentivos) may invoke
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'gestor_incentivos'::app_role)) THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  FOR v_alert IN
    SELECT * FROM public.analyze_supplier_prices(p_min_suppliers, p_high_pct, p_medium_pct)
    WHERE severity = 'alta'
  LOOP
    v_evaluated := v_evaluated + 1;
    v_entity_id := v_alert.product_id::text || '|' || v_alert.supplier_id::text;

    -- Dedupe: skip if any notification of this category/entity sent in window
    SELECT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE category = 'preco_alerta'
        AND entity_type = 'supplier_product'
        AND entity_id = v_entity_id
        AND created_at > now() - make_interval(hours => p_dedupe_hours)
    ) INTO v_exists;

    IF v_exists THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_title := 'Preço anormal: ' || v_alert.product_name;
    v_body := v_alert.supplier_name
              || ' pratica ' || to_char(v_alert.current_price, 'FM999G999G990D00')
              || ' Kz (média ' || to_char(v_alert.avg_price, 'FM999G999G990D00')
              || ' Kz, desvio ' || to_char(v_alert.deviation_pct, 'FM999990D0') || '%).';

    -- Insert for every admin + gestor_incentivos user
    FOR v_user IN
      SELECT DISTINCT ur.user_id
      FROM public.user_roles ur
      WHERE ur.role IN ('admin'::app_role, 'gestor_incentivos'::app_role)
    LOOP
      INSERT INTO public.notifications (user_id, title, body, category, entity_type, entity_id, read)
      VALUES (v_user.user_id, v_title, v_body, 'preco_alerta', 'supplier_product', v_entity_id, false);
      v_created := v_created + 1;
    END LOOP;
  END LOOP;

  RETURN QUERY SELECT v_created, v_evaluated, v_skipped;
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_price_alert_notifications(integer, numeric, numeric, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dispatch_price_alert_notifications(integer, numeric, numeric, integer) TO authenticated;
