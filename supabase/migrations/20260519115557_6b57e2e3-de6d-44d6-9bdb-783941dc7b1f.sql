CREATE OR REPLACE FUNCTION public.get_farmer_counts_by_location()
RETURNS TABLE (
  province text,
  municipality text,
  school text,
  total bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(NULLIF(TRIM(LOWER(province)), ''), '') AS province,
    COALESCE(NULLIF(TRIM(LOWER(municipality)), ''), '') AS municipality,
    COALESCE(NULLIF(TRIM(LOWER(school)), ''), '') AS school,
    COUNT(*)::bigint AS total
  FROM public.farmers
  GROUP BY 1, 2, 3;
$$;

REVOKE ALL ON FUNCTION public.get_farmer_counts_by_location() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_farmer_counts_by_location() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_farmer_counts_by_location() TO authenticated;