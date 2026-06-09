
-- 1. Baseline esperado por PATEC
CREATE TABLE public.patec_consistency_baseline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patec_id uuid NOT NULL UNIQUE REFERENCES public.patecs(id) ON DELETE CASCADE,
  expected_components int NOT NULL DEFAULT 0,
  expected_optional_components int NOT NULL DEFAULT 0,
  expected_expanded int NOT NULL DEFAULT 0,
  expected_expanded_optional int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.patec_consistency_baseline TO authenticated;
GRANT ALL ON public.patec_consistency_baseline TO service_role;
ALTER TABLE public.patec_consistency_baseline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth pode ver baseline PATEC"
  ON public.patec_consistency_baseline FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins gerem baseline PATEC"
  ON public.patec_consistency_baseline FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_patec_baseline_updated_at
  BEFORE UPDATE ON public.patec_consistency_baseline
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Relatórios de execução
CREATE TABLE public.patec_consistency_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  total_patecs int NOT NULL DEFAULT 0,
  total_divergences int NOT NULL DEFAULT 0,
  total_components int NOT NULL DEFAULT 0,
  total_expanded int NOT NULL DEFAULT 0,
  orphan_expanded int NOT NULL DEFAULT 0,
  orphan_component_items int NOT NULL DEFAULT 0,
  divergences jsonb NOT NULL DEFAULT '[]'::jsonb,
  triggered_by text NOT NULL DEFAULT 'cron',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_patec_consistency_reports_ran_at ON public.patec_consistency_reports(ran_at DESC);
GRANT SELECT ON public.patec_consistency_reports TO authenticated;
GRANT ALL ON public.patec_consistency_reports TO service_role;
ALTER TABLE public.patec_consistency_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins e gestores veem relatorios PATEC"
  ON public.patec_consistency_reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor_incentivos'));

-- 3. Popular baseline a partir das contagens actuais
INSERT INTO public.patec_consistency_baseline
  (patec_id, expected_components, expected_optional_components, expected_expanded, expected_expanded_optional)
SELECT p.id,
  (SELECT COUNT(*) FROM public.patec_package_components ppc WHERE ppc.patec_id = p.id),
  (SELECT COUNT(*) FROM public.patec_package_components ppc WHERE ppc.patec_id = p.id AND ppc.is_optional),
  (SELECT COUNT(*) FROM public.patec_package_expanded pe WHERE pe.patec_id = p.id),
  (SELECT COUNT(*) FROM public.patec_package_expanded pe WHERE pe.patec_id = p.id AND pe.is_optional)
FROM public.patecs p WHERE p.is_active
ON CONFLICT (patec_id) DO UPDATE SET
  expected_components = EXCLUDED.expected_components,
  expected_optional_components = EXCLUDED.expected_optional_components,
  expected_expanded = EXCLUDED.expected_expanded,
  expected_expanded_optional = EXCLUDED.expected_expanded_optional,
  updated_at = now();

-- 4. Função de validação
CREATE OR REPLACE FUNCTION public.run_patec_consistency_check(p_trigger text DEFAULT 'cron')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report_id uuid;
  v_divergences jsonb := '[]'::jsonb;
  v_total_divergences int := 0;
  v_total_patecs int := 0;
  v_total_components int;
  v_total_expanded int;
  v_orphan_expanded int;
  v_orphan_items int;
  r record;
  admin_id uuid;
BEGIN
  SELECT COUNT(*) INTO v_total_patecs FROM patecs WHERE is_active;
  SELECT COUNT(*) INTO v_total_components FROM patec_package_components;
  SELECT COUNT(*) INTO v_total_expanded FROM patec_package_expanded;

  SELECT COUNT(*) INTO v_orphan_expanded
  FROM patec_package_expanded pe
  WHERE NOT EXISTS (
    SELECT 1 FROM patec_package_components ppc
    WHERE ppc.patec_id = pe.patec_id AND ppc.component_id = pe.component_id
  );

  SELECT COUNT(*) INTO v_orphan_items
  FROM patec_component_items pci
  WHERE NOT EXISTS (SELECT 1 FROM patec_components c WHERE c.id = pci.component_id)
     OR NOT EXISTS (SELECT 1 FROM patec_products pr WHERE pr.id = pci.product_id);

  FOR r IN
    SELECT p.id, p.code, p.name,
      COALESCE(b.expected_components, 0) AS exp_comp,
      COALESCE(b.expected_optional_components, 0) AS exp_opt_comp,
      COALESCE(b.expected_expanded, 0) AS exp_exp,
      COALESCE(b.expected_expanded_optional, 0) AS exp_exp_opt,
      (SELECT COUNT(*) FROM patec_package_components ppc WHERE ppc.patec_id = p.id) AS act_comp,
      (SELECT COUNT(*) FROM patec_package_components ppc WHERE ppc.patec_id = p.id AND ppc.is_optional) AS act_opt_comp,
      (SELECT COUNT(*) FROM patec_package_expanded pe WHERE pe.patec_id = p.id) AS act_exp,
      (SELECT COUNT(*) FROM patec_package_expanded pe WHERE pe.patec_id = p.id AND pe.is_optional) AS act_exp_opt
    FROM patecs p
    LEFT JOIN patec_consistency_baseline b ON b.patec_id = p.id
    WHERE p.is_active
    ORDER BY p.code
  LOOP
    IF r.act_comp <> r.exp_comp
       OR r.act_opt_comp <> r.exp_opt_comp
       OR r.act_exp <> r.exp_exp
       OR r.act_exp_opt <> r.exp_exp_opt THEN
      v_total_divergences := v_total_divergences + 1;
      v_divergences := v_divergences || jsonb_build_object(
        'patec_id', r.id,
        'code', r.code,
        'name', r.name,
        'components', jsonb_build_object('expected', r.exp_comp, 'actual', r.act_comp),
        'optional_components', jsonb_build_object('expected', r.exp_opt_comp, 'actual', r.act_opt_comp),
        'expanded', jsonb_build_object('expected', r.exp_exp, 'actual', r.act_exp),
        'expanded_optional', jsonb_build_object('expected', r.exp_exp_opt, 'actual', r.act_exp_opt)
      );
    END IF;
  END LOOP;

  IF v_orphan_expanded > 0 OR v_orphan_items > 0 THEN
    v_total_divergences := v_total_divergences + 1;
  END IF;

  INSERT INTO patec_consistency_reports
    (total_patecs, total_divergences, total_components, total_expanded,
     orphan_expanded, orphan_component_items, divergences, triggered_by)
  VALUES (v_total_patecs, v_total_divergences, v_total_components, v_total_expanded,
          v_orphan_expanded, v_orphan_items, v_divergences, p_trigger)
  RETURNING id INTO v_report_id;

  IF v_total_divergences > 0 THEN
    FOR admin_id IN SELECT user_id FROM user_roles WHERE role = 'admin'
    LOOP
      INSERT INTO notifications (user_id, title, body, category, entity_type, entity_id)
      VALUES (
        admin_id,
        'Divergência na composição PATEC',
        format('Validação diária detectou %s divergência(s). %s órfãos em expanded, %s órfãos em BOM.',
               v_total_divergences, v_orphan_expanded, v_orphan_items),
        'sistema',
        'patec_consistency_report',
        v_report_id::text
      );
    END LOOP;
  END IF;

  RETURN v_report_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_patec_consistency_check(text) TO authenticated, service_role;

-- 5. Agendamento diário (03:00 UTC ≈ 04:00 Luanda)
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('patec-consistency-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'patec-consistency-daily',
  '0 3 * * *',
  $$SELECT public.run_patec_consistency_check('cron');$$
);

-- 6. Execução inicial para validar pipeline
SELECT public.run_patec_consistency_check('initial');
