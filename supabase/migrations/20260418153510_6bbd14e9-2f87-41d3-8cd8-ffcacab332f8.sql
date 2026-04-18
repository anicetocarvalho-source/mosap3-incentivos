-- Drop the old 3-argument version of dashboard_kpis to resolve ambiguity
-- The new 5-argument version (with p_from/p_to) handles both cases via NULL defaults
DROP FUNCTION IF EXISTS public.dashboard_kpis(text, text[], text[]);