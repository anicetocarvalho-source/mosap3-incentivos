
-- Update patec_items to support 10 PATECs with detailed composition
ALTER TABLE public.patec_items DROP CONSTRAINT IF EXISTS patec_items_patec_number_check;
ALTER TABLE public.patec_items DROP CONSTRAINT IF EXISTS patec_items_category_check;

ALTER TABLE public.patec_items
  ALTER COLUMN patec_number DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS subcategory text,
  ADD COLUMN IF NOT EXISTS culture text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

ALTER TABLE public.patec_items
  ADD CONSTRAINT patec_items_patec_number_check CHECK (patec_number IS NULL OR (patec_number BETWEEN 1 AND 50));
ALTER TABLE public.patec_items
  ADD CONSTRAINT patec_items_category_check CHECK (category IN ('agricultura','pecuaria','irrigacao','equipamento'));

CREATE INDEX IF NOT EXISTS idx_patec_items_subcategory ON public.patec_items(subcategory);
CREATE INDEX IF NOT EXISTS idx_patec_items_culture ON public.patec_items(culture);

-- Seed 10 PATECs
INSERT INTO public.patecs (code, name, cultures, icon, color_token, legacy_number, sort_order, is_active, description) VALUES
  ('PATEC-01','PATEC 1 — Milho + Feijão','Milho + Feijão','wheat','amber',1,1,true,'Cereais com pecuária avícola'),
  ('PATEC-02','PATEC 2 — Massango + Feijão','Massango + Feijão','wheat','orange',2,2,true,'Cereais com pecuária bovina'),
  ('PATEC-03','PATEC 3 — Massambala + Feijão','Massambala + Feijão','wheat','rose',3,3,true,'Cereais com pecuária caprina'),
  ('PATEC-04','PATEC 4 — Mandioca + Feijão','Mandioca + Feijão','sprout','emerald',4,4,true,'Tubérculo com pecuária ovina'),
  ('PATEC-05','PATEC 5 — Alho','Alho','sprout','violet',5,5,true,'Horticultura com pecuária suína'),
  ('PATEC-06','PATEC 6 — Batata Doce','Batata Doce','carrot','sky',6,6,true,'Tubérculo'),
  ('PATEC-07','PATEC 7 — Batata Rena','Batata Rena','carrot','slate',7,7,true,'Tubérculo'),
  ('PATEC-08','PATEC 8 — Cebola','Cebola','sprout','amber',8,8,true,'Horticultura'),
  ('PATEC-09','PATEC 9 — Cenoura','Cenoura','carrot','orange',9,9,true,'Horticultura'),
  ('PATEC-10','PATEC 10 — Repolho','Repolho','leaf','emerald',10,10,true,'Horticultura')
ON CONFLICT (code) DO NOTHING;
