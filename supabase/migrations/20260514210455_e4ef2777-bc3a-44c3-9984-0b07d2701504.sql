WITH alvo AS (
  SELECT id FROM public.farmers
  WHERE status = 'Removido'
    AND bi IS NULL
    AND school IS NULL
    AND registered_by IS NULL
    AND phone IS NOT NULL
)
UPDATE public.farmers f
SET 
  status = 'Pendente',
  sim_status = 'Activo',
  sim_status_source = 'unitel_export_2026-05-14',
  sim_status_updated_at = now(),
  updated_at = now()
FROM alvo
WHERE f.id = alvo.id;

INSERT INTO public.audit_logs (action, entity_type, entity_id, user_name, details)
VALUES (
  'bulk_restore_removidos_unitel',
  'farmers',
  'BATCH-1363',
  'Sistema (validação Unitel)',
  jsonb_build_object(
    'source', 'ALL_MOSAP_003-5.xlsx',
    'sheet', 'Detalhe',
    'total_rows_excel', 15166,
    'total_restaurados', 1363,
    'criterio', 'status=Removido + bi/school/registered_by NULL',
    'novo_status', 'Pendente',
    'novo_sim_status', 'Activo',
    'distribuicao_provincia', jsonb_build_object(
      'Benguela', 931, 'Cunene', 161, 'Huila', 131,
      'Cuando Cubango', 103, 'Namibe', 37
    ),
    'observacao_263_sem_saldo', 'SALDO_DISPONIVEL_MOSAP=0 no export — provavelmente já utilizaram o incentivo'
  )
);