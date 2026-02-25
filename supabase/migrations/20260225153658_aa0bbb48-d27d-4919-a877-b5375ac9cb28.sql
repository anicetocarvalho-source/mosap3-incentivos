
-- Table to store editable items for each PATEC package
CREATE TABLE public.patec_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patec_number INTEGER NOT NULL CHECK (patec_number IN (1, 2, 3)),
  category TEXT NOT NULL CHECK (category IN ('insumos', 'pecuaria', 'servicos')),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.patec_items ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can view
CREATE POLICY "Authenticated users can view patec_items" ON public.patec_items
  FOR SELECT USING (true);

-- Admins can manage
CREATE POLICY "Admins can insert patec_items" ON public.patec_items
  FOR INSERT WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update patec_items" ON public.patec_items
  FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete patec_items" ON public.patec_items
  FOR DELETE USING (is_admin(auth.uid()));

-- Seed default items
INSERT INTO public.patec_items (patec_number, category, name) VALUES
-- PATEC 1
(1, 'insumos', 'Semente de milho'),
(1, 'insumos', 'Semente de feijão'),
(1, 'insumos', 'Adubo composto'),
(1, 'insumos', 'Adubo simples'),
(1, 'insumos', 'Insecticida, fungicida'),
(1, 'insumos', 'Enxada, Catana, Lima, Ancinho, Machado, Carro de mão'),
(1, 'pecuaria', 'Cabra, Ovelha, Galinha, Boi'),
(1, 'pecuaria', 'Ração animal'),
(1, 'pecuaria', 'Vitaminas, Antibióticos'),
(1, 'pecuaria', 'Brincos'),
(1, 'pecuaria', 'Rede galinheiro'),
(1, 'pecuaria', 'Pregos, Chapas'),
(1, 'servicos', 'Preparação de terra mecanizada'),
(1, 'servicos', 'Amanhos culturais'),
(1, 'servicos', 'Transporte para escoamento da produção'),
-- PATEC 2
(2, 'insumos', 'Semente de massango'),
(2, 'insumos', 'Semente de feijão'),
(2, 'insumos', 'Adubo composto'),
(2, 'insumos', 'Adubo simples'),
(2, 'insumos', 'Insecticida, fungicida'),
(2, 'insumos', 'Enxada, Catana, Lima, Ancinho, Machado, Carro de mão'),
(2, 'pecuaria', 'Cabra, Ovelha, Galinha, Boi'),
(2, 'pecuaria', 'Ração animal'),
(2, 'pecuaria', 'Rede galinheiro'),
(2, 'pecuaria', 'Vitaminas, Antibióticos'),
(2, 'pecuaria', 'Brincos'),
(2, 'pecuaria', 'Pregos, Chapas'),
(2, 'servicos', 'Preparação de terra mecanizada'),
(2, 'servicos', 'Amanhos culturais'),
(2, 'servicos', 'Transporte para escoamento da produção'),
-- PATEC 3
(3, 'insumos', 'Semente de massambala'),
(3, 'insumos', 'Semente de feijão'),
(3, 'insumos', 'Adubo composto'),
(3, 'insumos', 'Adubo simples'),
(3, 'insumos', 'Insecticida, fungicida'),
(3, 'insumos', 'Enxada, Catana, Lima, Ancinho, Machado, Carro de mão'),
(3, 'pecuaria', 'Cabra, Ovelha, Galinha, Boi'),
(3, 'pecuaria', 'Ração animal'),
(3, 'pecuaria', 'Rede galinheiro'),
(3, 'pecuaria', 'Vitaminas, Antibióticos'),
(3, 'pecuaria', 'Brincos'),
(3, 'pecuaria', 'Pregos, Chapas'),
(3, 'servicos', 'Preparação de terra mecanizada'),
(3, 'servicos', 'Amanhos culturais'),
(3, 'servicos', 'Transporte para escoamento da produção');
