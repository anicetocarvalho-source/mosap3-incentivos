
-- 1. Link supplier_products to patec_items as authoritative catalog
ALTER TABLE public.supplier_products
  ADD COLUMN IF NOT EXISTS patec_item_id uuid REFERENCES public.patec_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_products_patec_item_id
  ON public.supplier_products(patec_item_id);

-- Unique guard: a supplier should not link the same patec item twice
CREATE UNIQUE INDEX IF NOT EXISTS supplier_products_supplier_patec_item_uniq
  ON public.supplier_products(supplier_id, patec_item_id)
  WHERE patec_item_id IS NOT NULL;

-- 2. Backfill: match existing supplier_products to patec_items by normalized name + patec_number
UPDATE public.supplier_products sp
   SET patec_item_id = pi.id
  FROM public.patec_items pi
 WHERE sp.patec_item_id IS NULL
   AND public.normalize_name(sp.name) = public.normalize_name(pi.name)
   AND ( sp.patec_number IS NULL
         OR pi.patec_number IS NULL
         OR sp.patec_number = pi.patec_number );

-- 3. BEFORE trigger on supplier_products: when patec_item_id set, sync identity fields from patec_items
CREATE OR REPLACE FUNCTION public.sync_supplier_product_from_patec()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_item record;
BEGIN
  IF NEW.patec_item_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT id, name, category, unit, patec_number, patec_code
    INTO v_item
    FROM public.patec_items
   WHERE id = NEW.patec_item_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  NEW.name           := v_item.name;
  NEW.category       := COALESCE(v_item.category, NEW.category);
  NEW.unit           := COALESCE(NULLIF(v_item.unit,''), NEW.unit);
  NEW.patec_number   := v_item.patec_number;
  NEW.patec_category := COALESCE(v_item.category, NEW.patec_category);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_supplier_product_from_patec ON public.supplier_products;
CREATE TRIGGER trg_sync_supplier_product_from_patec
  BEFORE INSERT OR UPDATE OF patec_item_id, name, category, unit, patec_number
  ON public.supplier_products
  FOR EACH ROW EXECUTE FUNCTION public.sync_supplier_product_from_patec();

-- 4. AFTER trigger on patec_items: propagate identity changes to all linked supplier_products
CREATE OR REPLACE FUNCTION public.propagate_patec_item_to_supplier_products()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name
     OR NEW.category IS DISTINCT FROM OLD.category
     OR NEW.unit IS DISTINCT FROM OLD.unit
     OR NEW.patec_number IS DISTINCT FROM OLD.patec_number THEN
    UPDATE public.supplier_products
       SET name           = NEW.name,
           category       = COALESCE(NEW.category, category),
           unit           = COALESCE(NULLIF(NEW.unit,''), unit),
           patec_number   = NEW.patec_number,
           patec_category = COALESCE(NEW.category, patec_category),
           updated_at     = now()
     WHERE patec_item_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_patec_item ON public.patec_items;
CREATE TRIGGER trg_propagate_patec_item
  AFTER UPDATE ON public.patec_items
  FOR EACH ROW EXECUTE FUNCTION public.propagate_patec_item_to_supplier_products();
