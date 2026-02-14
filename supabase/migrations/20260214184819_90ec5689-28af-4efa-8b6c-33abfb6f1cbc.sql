
-- Add authorization check to notify_all_users function
CREATE OR REPLACE FUNCTION public.notify_all_users(
  _title text,
  _body text,
  _category text DEFAULT 'sistema'::text,
  _entity_type text DEFAULT NULL::text,
  _entity_id text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user RECORD;
BEGIN
  -- Only allow system calls (NULL auth.uid from triggers) or admin users
  IF auth.uid() IS NOT NULL AND NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins or system triggers can broadcast notifications';
  END IF;

  FOR _user IN SELECT DISTINCT user_id FROM user_roles
  LOOP
    INSERT INTO notifications (user_id, title, body, category, entity_type, entity_id)
    VALUES (_user.user_id, _title, _body, _category, _entity_type, _entity_id);
  END LOOP;
END;
$$;
