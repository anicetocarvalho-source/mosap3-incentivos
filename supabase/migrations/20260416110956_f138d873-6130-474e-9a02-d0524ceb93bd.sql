
-- Table to persist the RBAC permissions matrix
CREATE TABLE public.module_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_name text NOT NULL,
  role text NOT NULL,
  has_access boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (module_name, role)
);

-- Enable RLS
ALTER TABLE public.module_permissions ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (needed for sidebar/guard checks)
CREATE POLICY "Auth users can view module permissions"
  ON public.module_permissions FOR SELECT TO authenticated
  USING (true);

-- Only admins can manage
CREATE POLICY "Admins can manage module permissions"
  ON public.module_permissions FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Seed with default values
INSERT INTO public.module_permissions (module_name, role, has_access)
SELECT mod, r, 
  CASE
    WHEN mod IN ('Dashboard','Cadastro de Agricultores','Registo do Pequeno Produtor','Escolas de Campo','Parcelas','Produção','Pecuária') THEN true
    WHEN mod = 'Relatórios' AND r NOT IN ('junior_agronegocio','tecnico_extensionista') THEN true
    WHEN mod = 'Gestão de Províncias' AND r IN ('admin','senior_agricultura','senior_monitoria') THEN true
    WHEN mod IN ('Incentivos','Transações') AND r IN ('admin','gestor_incentivos') THEN true
    WHEN mod IN ('Compras','Empresas') AND r IN ('admin','gestor_incentivos','senior_agronegocio','junior_agronegocio') THEN true
    WHEN mod IN ('Utilizadores','Configurações') AND r = 'admin' THEN true
    WHEN mod = 'Gestão de ECAs' AND r IN ('admin','tecnico_extensionista') THEN true
    ELSE false
  END
FROM unnest(ARRAY[
  'Dashboard','Cadastro de Agricultores','Registo do Pequeno Produtor','Escolas de Campo',
  'Incentivos','Transações','Compras','Parcelas','Empresas','Produção','Pecuária',
  'Relatórios','Gestão de Províncias','Utilizadores','Configurações','Gestão de ECAs'
]) AS mod
CROSS JOIN unnest(ARRAY[
  'admin','gestor_incentivos','senior_agricultura','senior_monitoria',
  'junior_monitoria','junior_agricultura','senior_agronegocio','junior_agronegocio','tecnico_extensionista'
]) AS r;
