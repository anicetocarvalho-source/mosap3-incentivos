
-- =============================================
-- MOSAP3Pay Module - Database Schema
-- =============================================

-- 1. Suppliers (fornecedores) - login separado via auth.users
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  nif text,
  phone text,
  email text,
  address text,
  province text,
  municipality text,
  logo_url text,
  status text NOT NULL DEFAULT 'Ativo',
  shortcode text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- 2. Supplier Products (catálogo de produtos por fornecedor)
CREATE TABLE public.supplier_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'insumos',
  unit text NOT NULL DEFAULT 'un',
  price numeric(12,2) NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  patec_number integer,
  patec_category text,
  iva_rate numeric(4,2) NOT NULL DEFAULT 14.00,
  max_per_farmer_per_season integer,
  status text NOT NULL DEFAULT 'Ativo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;

-- 3. Supplier POS terminals
CREATE TABLE public.supplier_pos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  pos_code text NOT NULL UNIQUE,
  label text,
  location text,
  operator_name text,
  operator_phone text,
  status text NOT NULL DEFAULT 'Ativo',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.supplier_pos ENABLE ROW LEVEL SECURITY;

-- 4. Season limits (limites por época/campanha)
CREATE TABLE public.season_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_name text NOT NULL,
  patec_number integer NOT NULL,
  product_category text NOT NULL DEFAULT 'insumos',
  max_total_value numeric(12,2),
  max_items integer,
  start_date date NOT NULL,
  end_date date NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.season_limits ENABLE ROW LEVEL SECURITY;

-- 5. POS Sales (vendas)
CREATE TABLE public.pos_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_code text NOT NULL UNIQUE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  pos_id uuid REFERENCES public.supplier_pos(id),
  farmer_code text NOT NULL,
  farmer_name text NOT NULL,
  farmer_phone text,
  patec_number integer,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  iva_total numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'unitel_money',
  payment_status text NOT NULL DEFAULT 'pendente',
  payment_reference text,
  unitel_transaction_id text,
  season text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pos_sales ENABLE ROW LEVEL SECURITY;

-- 6. POS Sale Items (itens de cada venda)
CREATE TABLE public.pos_sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.pos_sales(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.supplier_products(id),
  product_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL,
  iva_rate numeric(4,2) NOT NULL DEFAULT 14.00,
  iva_amount numeric(12,2) NOT NULL DEFAULT 0,
  line_total numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pos_sale_items ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS Policies
-- =============================================

-- Suppliers: admins manage, suppliers see own
CREATE POLICY "Admins can manage suppliers" ON public.suppliers FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Suppliers can view own" ON public.suppliers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Suppliers can update own" ON public.suppliers FOR UPDATE USING (auth.uid() = user_id);

-- Products: admins + own supplier
CREATE POLICY "Admins can manage products" ON public.supplier_products FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Auth users can view products" ON public.supplier_products FOR SELECT USING (true);
CREATE POLICY "Suppliers can manage own products" ON public.supplier_products FOR ALL USING (
  EXISTS (SELECT 1 FROM public.suppliers WHERE id = supplier_id AND user_id = auth.uid())
);

-- POS: admins + own supplier
CREATE POLICY "Admins can manage pos" ON public.supplier_pos FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Suppliers can manage own pos" ON public.supplier_pos FOR ALL USING (
  EXISTS (SELECT 1 FROM public.suppliers WHERE id = supplier_id AND user_id = auth.uid())
);
CREATE POLICY "Auth users can view pos" ON public.supplier_pos FOR SELECT USING (true);

-- Season limits: admins manage, all auth view
CREATE POLICY "Admins can manage season limits" ON public.season_limits FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Auth users can view season limits" ON public.season_limits FOR SELECT USING (true);

-- Sales: admins view all, suppliers view own
CREATE POLICY "Admins can manage sales" ON public.pos_sales FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Suppliers can view own sales" ON public.pos_sales FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.suppliers WHERE id = supplier_id AND user_id = auth.uid())
);
CREATE POLICY "Suppliers can insert own sales" ON public.pos_sales FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.suppliers WHERE id = supplier_id AND user_id = auth.uid())
);
CREATE POLICY "Auth users can view sales" ON public.pos_sales FOR SELECT USING (true);

-- Sale items: follow sales access
CREATE POLICY "Admins can manage sale items" ON public.pos_sale_items FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "Auth users can view sale items" ON public.pos_sale_items FOR SELECT USING (true);
CREATE POLICY "Suppliers can insert sale items" ON public.pos_sale_items FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.pos_sales s 
    JOIN public.suppliers sup ON sup.id = s.supplier_id 
    WHERE s.id = sale_id AND sup.user_id = auth.uid()
  )
);

-- Updated_at triggers
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_supplier_products_updated_at BEFORE UPDATE ON public.supplier_products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pos_sales_updated_at BEFORE UPDATE ON public.pos_sales FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
