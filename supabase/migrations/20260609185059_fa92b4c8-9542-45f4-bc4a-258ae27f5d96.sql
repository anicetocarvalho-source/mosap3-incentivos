
-- Remover índice único composto antigo (continuamos a usar season_id, mas o par farmer+patec é o que importa)
DROP INDEX IF EXISTS public.farmer_patecs_unique_assignment;

ALTER TABLE public.farmer_patecs
  ADD CONSTRAINT farmer_patecs_unique_pair UNIQUE (farmer_id, patec_code);
