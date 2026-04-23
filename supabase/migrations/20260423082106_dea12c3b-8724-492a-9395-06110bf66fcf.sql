CREATE OR REPLACE FUNCTION public.bulk_insert_orphan_phones(_data jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.orphan_phones (phone, amount)
  SELECT
    (elem->>'phone')::text,
    (elem->>'amount')::numeric
  FROM jsonb_array_elements(_data) elem
  ON CONFLICT (phone) DO UPDATE SET amount = EXCLUDED.amount;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;