CREATE UNIQUE INDEX IF NOT EXISTS supplier_products_supplier_name_uniq
  ON public.supplier_products (supplier_id, lower(name));