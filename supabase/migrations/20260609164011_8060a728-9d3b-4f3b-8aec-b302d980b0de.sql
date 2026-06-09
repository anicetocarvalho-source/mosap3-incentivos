
CREATE TABLE public.patec_component_baseline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id uuid NOT NULL UNIQUE REFERENCES public.patec_components(id) ON DELETE CASCADE,
  expected_items int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.patec_component_baseline TO authenticated;
GRANT ALL ON public.patec_component_baseline TO service_role;
ALTER TABLE public.patec_component_baseline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth pode ver baseline componente"
  ON public.patec_component_baseline FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins gerem baseline componente"
  ON public.patec_component_baseline FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_patec_component_baseline_updated_at
  BEFORE UPDATE ON public.patec_component_baseline
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.patec_global_baseline (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  expected_orphan_components int NOT NULL DEFAULT 0,
  expected_orphan_products int NOT NULL DEFAULT 0,
  expected_total_items int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.patec_global_baseline TO authenticated;
GRANT ALL ON public.patec_global_baseline TO service_role;
ALTER TABLE public.patec_global_baseline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth pode ver baseline global"
  ON public.patec_global_baseline FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins gerem baseline global"
  ON public.patec_global_baseline FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_patec_global_baseline_updated_at
  BEFORE UPDATE ON public.patec_global_baseline
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.patec_component_baseline (component_id, expected_items)
SELECT comp.id, (SELECT COUNT(*) FROM public.patec_component_items pci WHERE pci.component_id = comp.id)
FROM public.patec_components comp
ON CONFLICT (component_id) DO UPDATE SET
  expected_items = EXCLUDED.expected_items, updated_at = now();

INSERT INTO public.patec_global_baseline (id, expected_orphan_components, expected_orphan_products, expected_total_items)
VALUES (
  1,
  (SELECT COUNT(*) FROM public.patec_components comp WHERE NOT EXISTS (SELECT 1 FROM public.patec_package_components ppc WHERE ppc.component_id = comp.id)),
  (SELECT COUNT(*) FROM public.patec_products prod WHERE NOT EXISTS (SELECT 1 FROM public.patec_component_items pci WHERE pci.product_id = prod.id)),
  (SELECT COUNT(*) FROM public.patec_component_items)
)
ON CONFLICT (id) DO UPDATE SET
  expected_orphan_components = EXCLUDED.expected_orphan_components,
  expected_orphan_products = EXCLUDED.expected_orphan_products,
  expected_total_items = EXCLUDED.expected_total_items,
  updated_at = now();

ALTER TABLE public.patec_consistency_reports
  ADD COLUMN IF NOT EXISTS total_items int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS orphan_components int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS orphan_products int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS component_divergences jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.run_patec_consistency_check(p_trigger text DEFAULT 'cron')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report_id uuid;
  v_divergences jsonb := '[]'::jsonb;
  v_comp_divergences jsonb := '[]'::jsonb;
  v_total_divergences int := 0;
  v_total_patecs int := 0;
  v_total_components int;
  v_total_expanded int;
  v_total_items int;
  v_orphan_expanded int;
  v_orphan_items int;
  v_orphan_components int;
  v_orphan_products int;
  v_exp_orphan_comp int;
  v_exp_orphan_prod int;
  v_exp_total_items int;
  patec_row record;
  comp_row record;
  admin_id uuid;
BEGIN
  SELECT COUNT(*) INTO v_total_patecs FROM patecs WHERE is_active;
  SELECT COUNT(*) INTO v_total_components FROM patec_package_components;
  SELECT COUNT(*) INTO v_total_expanded FROM patec_package_expanded;
  SELECT COUNT(*) INTO v_total_items FROM patec_component_items;

  SELECT COUNT(*) INTO v_orphan_expanded
  FROM patec_package_expanded pe
  WHERE NOT EXISTS (
    SELECT 1 FROM patec_package_components ppc
    WHERE ppc.patec_id = pe.patec_id AND ppc.component_id = pe.component_id
  );

  SELECT COUNT(*) INTO v_orphan_items
  FROM patec_component_items pci
  WHERE NOT EXISTS (SELECT 1 FROM patec_components pc WHERE pc.id = pci.component_id)
     OR NOT EXISTS (SELECT 1 FROM patec_products pp WHERE pp.id = pci.product_id);

  SELECT COUNT(*) INTO v_orphan_components
  FROM patec_components pc
  WHERE NOT EXISTS (SELECT 1 FROM patec_package_components ppc WHERE ppc.component_id = pc.id);

  SELECT COUNT(*) INTO v_orphan_products
  FROM patec_products pp
  WHERE NOT EXISTS (SELECT 1 FROM patec_component_items pci WHERE pci.product_id = pp.id);

  SELECT expected_orphan_components, expected_orphan_products, expected_total_items
    INTO v_exp_orphan_comp, v_exp_orphan_prod, v_exp_total_items
  FROM patec_global_baseline WHERE id = 1;

  FOR patec_row IN
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
    IF patec_row.act_comp <> patec_row.exp_comp OR patec_row.act_opt_comp <> patec_row.exp_opt_comp
       OR patec_row.act_exp <> patec_row.exp_exp OR patec_row.act_exp_opt <> patec_row.exp_exp_opt THEN
      v_total_divergences := v_total_divergences + 1;
      v_divergences := v_divergences || jsonb_build_object(
        'patec_id', patec_row.id, 'code', patec_row.code, 'name', patec_row.name,
        'components', jsonb_build_object('expected', patec_row.exp_comp, 'actual', patec_row.act_comp),
        'optional_components', jsonb_build_object('expected', patec_row.exp_opt_comp, 'actual', patec_row.act_opt_comp),
        'expanded', jsonb_build_object('expected', patec_row.exp_exp, 'actual', patec_row.act_exp),
        'expanded_optional', jsonb_build_object('expected', patec_row.exp_exp_opt, 'actual', patec_row.act_exp_opt)
      );
    END IF;
  END LOOP;

  FOR comp_row IN
    SELECT cmp.id, cmp.component_code, cmp.name,
      COALESCE(cb.expected_items, 0) AS exp_items,
      (SELECT COUNT(*) FROM patec_component_items pci WHERE pci.component_id = cmp.id) AS act_items
    FROM patec_components cmp
    LEFT JOIN patec_component_baseline cb ON cb.component_id = cmp.id
    ORDER BY cmp.component_code
  LOOP
    IF comp_row.act_items <> comp_row.exp_items THEN
      v_total_divergences := v_total_divergences + 1;
      v_comp_divergences := v_comp_divergences || jsonb_build_object(
        'component_id', comp_row.id, 'code', comp_row.component_code, 'name', comp_row.name,
        'items', jsonb_build_object('expected', comp_row.exp_items, 'actual', comp_row.act_items)
      );
    END IF;
  END LOOP;

  IF v_orphan_expanded > 0 THEN v_total_divergences := v_total_divergences + 1; END IF;
  IF v_orphan_items > 0 THEN v_total_divergences := v_total_divergences + 1; END IF;
  IF v_orphan_components > COALESCE(v_exp_orphan_comp, 0) THEN v_total_divergences := v_total_divergences + 1; END IF;
  IF v_orphan_products > COALESCE(v_exp_orphan_prod, 0) THEN v_total_divergences := v_total_divergences + 1; END IF;
  IF v_total_items <> COALESCE(v_exp_total_items, v_total_items) THEN v_total_divergences := v_total_divergences + 1; END IF;

  INSERT INTO patec_consistency_reports
    (total_patecs, total_divergences, total_components, total_expanded, total_items,
     orphan_expanded, orphan_component_items, orphan_components, orphan_products,
     divergences, component_divergences, triggered_by)
  VALUES (v_total_patecs, v_total_divergences, v_total_components, v_total_expanded, v_total_items,
          v_orphan_expanded, v_orphan_items, v_orphan_components, v_orphan_products,
          v_divergences, v_comp_divergences, p_trigger)
  RETURNING id INTO v_report_id;

  IF v_total_divergences > 0 THEN
    FOR admin_id IN SELECT user_id FROM user_roles WHERE role = 'admin'
    LOOP
      INSERT INTO notifications (user_id, title, body, category, entity_type, entity_id)
      VALUES (
        admin_id,
        'Divergência na composição PATEC',
        format('Validação detectou %s divergência(s). Expanded órfãos: %s | BOM órfãos: %s | Componentes não usados: %s/%s | Produtos não usados: %s/%s | Itens: %s/%s.',
               v_total_divergences, v_orphan_expanded, v_orphan_items,
               v_orphan_components, COALESCE(v_exp_orphan_comp, 0),
               v_orphan_products, COALESCE(v_exp_orphan_prod, 0),
               v_total_items, COALESCE(v_exp_total_items, v_total_items)),
        'sistema', 'patec_consistency_report', v_report_id::text
      );
    END LOOP;
  END IF;

  RETURN v_report_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_patec_consistency_check(text) TO authenticated, service_role;

SELECT public.run_patec_consistency_check('initial-extended');
