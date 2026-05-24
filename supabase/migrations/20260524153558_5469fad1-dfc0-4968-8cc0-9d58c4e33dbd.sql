
CREATE INDEX IF NOT EXISTS idx_pos_sale_items_sale_id
  ON public.pos_sale_items (sale_id);

CREATE INDEX IF NOT EXISTS idx_farmer_incentives_code_date
  ON public.farmer_incentives (farmer_code, incentive_date DESC);

CREATE INDEX IF NOT EXISTS idx_farmer_incentives_status
  ON public.farmer_incentives (status);

CREATE INDEX IF NOT EXISTS idx_pos_sales_supplier_created
  ON public.pos_sales (supplier_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created
  ON public.audit_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS TABLE (deleted_read bigint, deleted_unread bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_read bigint := 0;
  v_unread bigint := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem executar a limpeza.';
  END IF;

  WITH d AS (
    DELETE FROM public.notifications
    WHERE read = true AND created_at < now() - INTERVAL '90 days'
    RETURNING 1
  )
  SELECT count(*) INTO v_read FROM d;

  WITH d AS (
    DELETE FROM public.notifications
    WHERE read = false AND created_at < now() - INTERVAL '180 days'
    RETURNING 1
  )
  SELECT count(*) INTO v_unread FROM d;

  RETURN QUERY SELECT v_read, v_unread;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_notifications() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_old_notifications() TO authenticated;
