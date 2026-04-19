ALTER TABLE public.patec_items
  ADD COLUMN IF NOT EXISTS base_quantity numeric,
  ADD COLUMN IF NOT EXISTS unit text;

ALTER TABLE public.pos_sales
  ADD COLUMN IF NOT EXISTS parcel_size numeric,
  ADD COLUMN IF NOT EXISTS parcel_size_label text;