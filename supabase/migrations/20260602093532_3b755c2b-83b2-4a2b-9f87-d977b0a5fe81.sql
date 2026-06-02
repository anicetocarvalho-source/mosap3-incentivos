
-- Limpar entradas órfãs e do perfil fornecedor
DELETE FROM public.module_permissions WHERE module_name IN ('Compras','Empresas');
DELETE FROM public.module_permissions WHERE role = 'fornecedor';

-- Popular matriz (idempotente: apaga e re-insere para roles backoffice)
DELETE FROM public.module_permissions
WHERE role IN (
  'admin','gestor_incentivos',
  'senior_agricultura','senior_monitoria','senior_agronegocio',
  'junior_agricultura','junior_monitoria','junior_agronegocio',
  'tecnico_extensionista'
);

INSERT INTO public.module_permissions (module_name, role, has_access) VALUES
-- Dashboard: todos
('Dashboard','admin',true),('Dashboard','gestor_incentivos',true),
('Dashboard','senior_agricultura',true),('Dashboard','senior_monitoria',true),('Dashboard','senior_agronegocio',true),
('Dashboard','junior_agricultura',true),('Dashboard','junior_monitoria',true),('Dashboard','junior_agronegocio',true),
('Dashboard','tecnico_extensionista',true),

-- Cadastro de Agricultores: todos
('Cadastro de Agricultores','admin',true),('Cadastro de Agricultores','gestor_incentivos',true),
('Cadastro de Agricultores','senior_agricultura',true),('Cadastro de Agricultores','senior_monitoria',true),('Cadastro de Agricultores','senior_agronegocio',true),
('Cadastro de Agricultores','junior_agricultura',true),('Cadastro de Agricultores','junior_monitoria',true),('Cadastro de Agricultores','junior_agronegocio',true),
('Cadastro de Agricultores','tecnico_extensionista',true),

-- Registo do Pequeno Produtor: todos (sub-página)
('Registo do Pequeno Produtor','admin',true),('Registo do Pequeno Produtor','gestor_incentivos',true),
('Registo do Pequeno Produtor','senior_agricultura',true),('Registo do Pequeno Produtor','senior_monitoria',true),('Registo do Pequeno Produtor','senior_agronegocio',true),
('Registo do Pequeno Produtor','junior_agricultura',true),('Registo do Pequeno Produtor','junior_monitoria',true),('Registo do Pequeno Produtor','junior_agronegocio',true),
('Registo do Pequeno Produtor','tecnico_extensionista',true),

-- Escolas de Campo: todos
('Escolas de Campo','admin',true),('Escolas de Campo','gestor_incentivos',true),
('Escolas de Campo','senior_agricultura',true),('Escolas de Campo','senior_monitoria',true),('Escolas de Campo','senior_agronegocio',true),
('Escolas de Campo','junior_agricultura',true),('Escolas de Campo','junior_monitoria',true),('Escolas de Campo','junior_agronegocio',true),
('Escolas de Campo','tecnico_extensionista',true),

-- Parcelas: admin, gestor, sénior agricultura, júnior agricultura, técnico extensionista
('Parcelas','admin',true),('Parcelas','gestor_incentivos',true),
('Parcelas','senior_agricultura',true),('Parcelas','senior_monitoria',false),('Parcelas','senior_agronegocio',false),
('Parcelas','junior_agricultura',true),('Parcelas','junior_monitoria',false),('Parcelas','junior_agronegocio',false),
('Parcelas','tecnico_extensionista',true),

-- Produção: idem Parcelas
('Produção','admin',true),('Produção','gestor_incentivos',true),
('Produção','senior_agricultura',true),('Produção','senior_monitoria',false),('Produção','senior_agronegocio',false),
('Produção','junior_agricultura',true),('Produção','junior_monitoria',false),('Produção','junior_agronegocio',false),
('Produção','tecnico_extensionista',true),

-- Pecuária: idem Parcelas
('Pecuária','admin',true),('Pecuária','gestor_incentivos',true),
('Pecuária','senior_agricultura',true),('Pecuária','senior_monitoria',false),('Pecuária','senior_agronegocio',false),
('Pecuária','junior_agricultura',true),('Pecuária','junior_monitoria',false),('Pecuária','junior_agronegocio',false),
('Pecuária','tecnico_extensionista',true),

-- Incentivos: admin + gestor
('Incentivos','admin',true),('Incentivos','gestor_incentivos',true),
('Incentivos','senior_agricultura',false),('Incentivos','senior_monitoria',false),('Incentivos','senior_agronegocio',false),
('Incentivos','junior_agricultura',false),('Incentivos','junior_monitoria',false),('Incentivos','junior_agronegocio',false),
('Incentivos','tecnico_extensionista',false),

-- MOSAP3Pay: admin + gestor
('MOSAP3Pay','admin',true),('MOSAP3Pay','gestor_incentivos',true),
('MOSAP3Pay','senior_agricultura',false),('MOSAP3Pay','senior_monitoria',false),('MOSAP3Pay','senior_agronegocio',false),
('MOSAP3Pay','junior_agricultura',false),('MOSAP3Pay','junior_monitoria',false),('MOSAP3Pay','junior_agronegocio',false),
('MOSAP3Pay','tecnico_extensionista',false),

-- Transações: admin + gestor
('Transações','admin',true),('Transações','gestor_incentivos',true),
('Transações','senior_agricultura',false),('Transações','senior_monitoria',false),('Transações','senior_agronegocio',false),
('Transações','junior_agricultura',false),('Transações','junior_monitoria',false),('Transações','junior_agronegocio',false),
('Transações','tecnico_extensionista',false),

-- Relatórios: todos backoffice excepto técnico extensionista
('Relatórios','admin',true),('Relatórios','gestor_incentivos',true),
('Relatórios','senior_agricultura',true),('Relatórios','senior_monitoria',true),('Relatórios','senior_agronegocio',true),
('Relatórios','junior_agricultura',true),('Relatórios','junior_monitoria',true),('Relatórios','junior_agronegocio',true),
('Relatórios','tecnico_extensionista',false),

-- Gestão de Províncias: só admin
('Gestão de Províncias','admin',true),('Gestão de Províncias','gestor_incentivos',false),
('Gestão de Províncias','senior_agricultura',false),('Gestão de Províncias','senior_monitoria',false),('Gestão de Províncias','senior_agronegocio',false),
('Gestão de Províncias','junior_agricultura',false),('Gestão de Províncias','junior_monitoria',false),('Gestão de Províncias','junior_agronegocio',false),
('Gestão de Províncias','tecnico_extensionista',false),

-- Utilizadores: só admin
('Utilizadores','admin',true),('Utilizadores','gestor_incentivos',false),
('Utilizadores','senior_agricultura',false),('Utilizadores','senior_monitoria',false),('Utilizadores','senior_agronegocio',false),
('Utilizadores','junior_agricultura',false),('Utilizadores','junior_monitoria',false),('Utilizadores','junior_agronegocio',false),
('Utilizadores','tecnico_extensionista',false),

-- Configurações: só admin
('Configurações','admin',true),('Configurações','gestor_incentivos',false),
('Configurações','senior_agricultura',false),('Configurações','senior_monitoria',false),('Configurações','senior_agronegocio',false),
('Configurações','junior_agricultura',false),('Configurações','junior_monitoria',false),('Configurações','junior_agronegocio',false),
('Configurações','tecnico_extensionista',false),

-- Gestão de ECAs: admin, gestor e séniores
('Gestão de ECAs','admin',true),('Gestão de ECAs','gestor_incentivos',true),
('Gestão de ECAs','senior_agricultura',true),('Gestão de ECAs','senior_monitoria',true),('Gestão de ECAs','senior_agronegocio',true),
('Gestão de ECAs','junior_agricultura',false),('Gestão de ECAs','junior_monitoria',false),('Gestão de ECAs','junior_agronegocio',false),
('Gestão de ECAs','tecnico_extensionista',false);
