
-- ===== Tabelas =====
DROP POLICY IF EXISTS "Auth users can view pos" ON public.supplier_pos;
CREATE POLICY "Backoffice or owner can view pos"
  ON public.supplier_pos FOR SELECT TO authenticated
  USING (
    public.has_any_backoffice_role(auth.uid())
    OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_pos.supplier_id AND s.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Auth users can view stores" ON public.supplier_stores;

DROP POLICY IF EXISTS "Auth users can view sequences" ON public.invoice_sequences;
CREATE POLICY "Backoffice or owner can view sequences"
  ON public.invoice_sequences FOR SELECT TO authenticated
  USING (
    public.has_any_backoffice_role(auth.uid())
    OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = invoice_sequences.supplier_id AND s.user_id = auth.uid())
  );

-- ===== Storage: farmer-media =====
DROP POLICY IF EXISTS "Authenticated users can view farmer media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update farmer media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload farmer media" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can read farmer documents" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can upload farmer documents" ON storage.objects;

CREATE POLICY "Backoffice or supplier can read farmer media"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'farmer-media' AND (
      public.has_any_backoffice_role(auth.uid())
      OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.user_id = auth.uid())
    )
  );

CREATE POLICY "Backoffice can upload farmer media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'farmer-media' AND public.has_any_backoffice_role(auth.uid())
  );

CREATE POLICY "Backoffice can update farmer media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'farmer-media' AND public.has_any_backoffice_role(auth.uid())
  );

-- ===== Storage: supplier-logos =====
DROP POLICY IF EXISTS "Auth users can delete supplier logos" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can update supplier logos" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can upload supplier logos" ON storage.objects;

CREATE POLICY "Admin or owner can upload supplier logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'supplier-logos' AND (
      public.is_admin(auth.uid())
      OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.user_id = auth.uid())
    )
  );

CREATE POLICY "Admin or owner can update supplier logos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'supplier-logos' AND (
      public.is_admin(auth.uid())
      OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.user_id = auth.uid())
    )
  );

CREATE POLICY "Admin or owner can delete supplier logos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'supplier-logos' AND (
      public.is_admin(auth.uid())
      OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.user_id = auth.uid())
    )
  );
