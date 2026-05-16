-- Atribuir província/município ao agricultor com dados em falta usando inferência
-- baseada na proximidade de número de telefone (cluster Menongue / Cuando-Cubango).
-- Escola permanece desconhecida (NULL) — registamos a inferência em audit_logs.

UPDATE public.farmers
SET province = 'Cuando-Cubango',
    municipality = 'Menongue',
    updated_at = now()
WHERE code = 'AGR-976107290'
  AND province IS NULL;

INSERT INTO public.audit_logs (action, entity_type, entity_id, user_name, details)
VALUES (
  'province_inference',
  'farmer',
  'AGR-976107290',
  'system',
  jsonb_build_object(
    'farmer_code', 'AGR-976107290',
    'full_name', 'Ester Daniel',
    'phone', '244976107290',
    'inferred_province', 'Cuando-Cubango',
    'inferred_municipality', 'Menongue',
    'school_status', 'desconhecida',
    'method', 'phone_prefix_neighbor_cluster',
    'evidence', 'Vizinhos 244976105xxx-244976106xxx pertencem a Menongue/Cuando-Cubango; sem vizinhos noutras províncias no intervalo 244976107xxx.',
    'confidence', 'alta'
  )
);