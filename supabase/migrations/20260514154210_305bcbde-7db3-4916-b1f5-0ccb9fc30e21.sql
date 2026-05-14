
CREATE OR REPLACE FUNCTION public.list_backoffice_managers(_role text DEFAULT NULL)
RETURNS TABLE(user_id uuid, full_name text, role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ur.user_id, COALESCE(p.full_name, '') AS full_name, ur.role::text AS role
  FROM public.user_roles ur
  LEFT JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE _role IS NULL OR _role = '' OR ur.role::text = _role
  ORDER BY ur.role::text, full_name;
$$;

CREATE OR REPLACE FUNCTION public.notify_users_by_role(
  _title text, _body text, _role text DEFAULT NULL,
  _category text DEFAULT 'sistema', _entity_type text DEFAULT NULL, _entity_id text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _u RECORD; _n int := 0;
BEGIN
  FOR _u IN
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    WHERE _role IS NULL OR _role = '' OR ur.role::text = _role
  LOOP
    INSERT INTO public.notifications(user_id, title, body, category, entity_type, entity_id)
    VALUES (_u.user_id, _title, _body, _category, _entity_type, _entity_id);
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END;
$$;
