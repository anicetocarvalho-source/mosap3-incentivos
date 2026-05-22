-- Add multi-culture support to parcels
ALTER TABLE public.farmer_parcels
  ADD COLUMN IF NOT EXISTS cultures text[] NOT NULL DEFAULT '{}';

UPDATE public.farmer_parcels
  SET cultures = ARRAY[culture]
  WHERE (cultures IS NULL OR array_length(cultures, 1) IS NULL)
    AND culture IS NOT NULL
    AND length(culture) > 0;

CREATE INDEX IF NOT EXISTS idx_farmer_parcels_cultures
  ON public.farmer_parcels USING GIN (cultures);