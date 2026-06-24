
-- 1) Add is_active to patec_items
ALTER TABLE public.patec_items
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 2) Extend propagate trigger to cascade is_active -> supplier_products.status
CREATE OR REPLACE FUNCTION public.propagate_patec_item_to_supplier_products()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- Cascade archive / restore based on is_active
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    IF NEW.is_active = false THEN
      UPDATE public.supplier_products
         SET status = 'inactive', updated_at = now()
       WHERE patec_item_id = NEW.id
         AND status <> 'inactive';
    ELSE
      UPDATE public.supplier_products
         SET status = 'active', updated_at = now()
       WHERE patec_item_id = NEW.id
         AND status = 'inactive';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 3) On insert/link, if the PATEC item is archived, force supplier_product inactive
CREATE OR REPLACE FUNCTION public.sync_supplier_product_from_patec()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_item record;
BEGIN
  IF NEW.patec_item_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT id, name, category, unit, patec_number, patec_code, is_active
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
  IF v_item.is_active = false THEN
    NEW.status := 'inactive';
  END IF;
  RETURN NEW;
END;
$function$;

-- 4) When a patec_item is hard-deleted, archive its supplier_products instead of breaking history
CREATE OR REPLACE FUNCTION public.archive_supplier_products_on_patec_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.supplier_products
     SET status = 'inactive', patec_item_id = NULL, updated_at = now()
   WHERE patec_item_id = OLD.id;
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS trg_archive_supplier_products_on_patec_delete ON public.patec_items;
CREATE TRIGGER trg_archive_supplier_products_on_patec_delete
BEFORE DELETE ON public.patec_items
FOR EACH ROW EXECUTE FUNCTION public.archive_supplier_products_on_patec_delete();
