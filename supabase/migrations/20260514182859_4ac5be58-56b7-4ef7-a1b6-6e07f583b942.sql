
DROP FUNCTION IF EXISTS public.bulk_insert_orphan_phones(jsonb);

CREATE OR REPLACE FUNCTION public.bulk_insert_orphan_phones(_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_inserted int := 0;
  v_linked int := 0;
  v_credited int := 0;
  v_total_kz numeric := 0;
  v_truly_orphan int := 0;
  v_ambiguous int := 0;
  v_user uuid := auth.uid();
BEGIN
  WITH src AS (
    SELECT
      RIGHT(regexp_replace((elem->>'phone')::text, '\D', '', 'g'), 9) AS phone9,
      (elem->>'amount')::numeric AS amount
    FROM jsonb_array_elements(_data) elem
    WHERE NULLIF((elem->>'phone')::text, '') IS NOT NULL
  ),
  agg AS (
    SELECT phone9 AS phone, SUM(amount) AS amount
    FROM src
    WHERE LENGTH(phone9) = 9
    GROUP BY phone9
  ),
  ins AS (
    INSERT INTO public.orphan_phones (phone, amount)
    SELECT phone, amount FROM agg
    ON CONFLICT (phone) DO UPDATE
      SET amount = EXCLUDED.amount, updated_at = now()
    RETURNING id
  )
  SELECT COUNT(*) INTO v_inserted FROM ins;

  WITH pendentes AS (
    SELECT id, phone, amount FROM public.orphan_phones
    WHERE linked_farmer_code IS NULL
  ),
  f AS (
    SELECT code, valor_recebido,
           RIGHT(regexp_replace(phone, '\D', '', 'g'), 9) AS p9
    FROM public.farmers
    WHERE phone IS NOT NULL AND phone <> ''
  ),
  matches AS (
    SELECT p.id AS orphan_id, p.amount,
           (array_agg(f.code))[1] AS code,
           (array_agg(f.valor_recebido))[1] AS old_valor,
           COUNT(*) AS n
    FROM pendentes p
    JOIN f ON f.p9 = p.phone
    GROUP BY p.id, p.amount
  ),
  unique_matches AS (SELECT * FROM matches WHERE n = 1),
  ambig AS (SELECT COUNT(*) AS c FROM matches WHERE n > 1),
  per_farmer AS (
    SELECT code,
           (array_agg(old_valor))[1] AS old_valor,
           SUM(amount) AS delta,
           array_agg(orphan_id::text) AS orphan_ids
    FROM unique_matches
    GROUP BY code
  ),
  upd_orphans AS (
    UPDATE public.orphan_phones op
    SET linked_farmer_code = m.code,
        linked_at = now(),
        linked_by = v_user,
        notes = 'Auto-associado na importação (match últimos 9 dígitos)',
        updated_at = now()
    FROM unique_matches m
    WHERE op.id = m.orphan_id
    RETURNING op.id
  ),
  upd_farmers AS (
    UPDATE public.farmers fa
    SET valor_recebido = to_char(
          COALESCE(NULLIF(replace(replace(fa.valor_recebido,'.',''),',','.'),'')::numeric, 0)
          + a.delta,
          'FM999G999G999G990D00'
        ),
        updated_at = now()
    FROM per_farmer a
    WHERE fa.code = a.code
    RETURNING fa.code, fa.valor_recebido AS new_valor, a.delta, a.old_valor, a.orphan_ids
  ),
  hist AS (
    INSERT INTO public.farmer_balance_history
      (farmer_code, field, old_value, new_value, delta, source, source_ref, notes, changed_by)
    SELECT code, 'valor_recebido', old_valor, new_valor, delta,
           'orphan_phone_auto_link',
           array_to_string(orphan_ids, ','),
           'Auto-associação automática de ' || array_length(orphan_ids,1) || ' telefone(s) órfão(s) na importação',
           v_user
    FROM upd_farmers
    RETURNING farmer_code
  )
  SELECT
    (SELECT COUNT(*) FROM upd_orphans),
    (SELECT COUNT(*) FROM upd_farmers),
    (SELECT COALESCE(SUM(delta),0) FROM upd_farmers),
    (SELECT c FROM ambig)
  INTO v_linked, v_credited, v_total_kz, v_ambiguous;

  SELECT COUNT(*) INTO v_truly_orphan
  FROM public.orphan_phones
  WHERE linked_farmer_code IS NULL;

  INSERT INTO public.audit_logs (action, entity_type, user_id, user_name, details)
  VALUES (
    'bulk_insert_orphan_phones', 'orphan_phones', v_user,
    COALESCE((SELECT full_name FROM public.profiles WHERE user_id = v_user), 'system'),
    jsonb_build_object(
      'inserted_or_updated', v_inserted,
      'auto_linked', v_linked,
      'farmers_credited', v_credited,
      'total_credited_kz', v_total_kz,
      'still_orphan', v_truly_orphan,
      'ambiguous_unlinked', v_ambiguous,
      'method', 'last_9_digits_match'
    )
  );

  RETURN jsonb_build_object(
    'inserted_or_updated', v_inserted,
    'auto_linked', v_linked,
    'farmers_credited', v_credited,
    'total_credited_kz', v_total_kz,
    'still_orphan', v_truly_orphan,
    'ambiguous_unlinked', v_ambiguous
  );
END;
$function$;
