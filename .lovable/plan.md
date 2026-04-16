

# Inventário Completo da Plataforma MOSAP3

## Plataforma Principal (Backoffice)

| Módulo | Rota(s) | Componentes principais | Dependências externas | Estado |
|---|---|---|---|---|
| Autenticação | `/auth` | `Auth.tsx`, `useAuth`, `offlineAuth`, `authSessionClockSkew` | Supabase Auth, IndexedDB, Zod | Completo |
| Dashboard | `/` | `Dashboard.tsx`, `StatCard`, `useDashboardData`, Recharts | Supabase (farmers, production, livestock, transactions) | Completo |
| Produtores | `/agricultores`, `/agricultores/:id`, `/agricultores/:id/ficha` | `Agricultores.tsx`, `FarmerProfile.tsx`, `FichaProdutor.tsx`, `FarmerRegistrationForm`, `BulkImportDialog`, `FarmerDocuments`, `FarmerAvatar`, `FingerprintCapture`, `DependentRegistrationForm` | Supabase (farmers + 6 sub-tabelas), Storage (farmer-media), xlsx | Completo |
| Escolas de Campo | `/escolas`, `/escolas/provincia/:slug`, `/escolas/:id`, `/escolas/:id/ficha` | `EscolasCampo.tsx`, `ProvinciaEscolas.tsx`, `EscolaDetalhe.tsx`, `FichaEscola.tsx`, `ParcelasMap` | Supabase (schools, provinces, municipalities), Leaflet, ArcGIS | Completo |
| Parcelas | `/parcelas` | `Parcelas.tsx`, `ParcelRegistrationForm`, `ParcelasMap` | Supabase (farmer_parcels), Leaflet | Completo |
| Produção | `/producao` | `Producao.tsx`, `TransactionRegistrationForm` | Supabase (farmer_production, farmer_production_phases) | Completo |
| PATEC | `/patec` | `Patec.tsx` | Supabase (patec_items, farmers) | Completo |
| Incentivos | `/incentivos` | `Incentivos.tsx`, `BatchDistributionDialog` | Supabase (farmer_incentives) | Completo |
| Transações | `/transacoes` | `Transacoes.tsx` | Supabase (farmer_transactions) | Completo |
| Relatórios | `/relatorios` | `Relatorios.tsx`, `ReportCharts`, `ReportPreview` | Supabase (múltiplas tabelas), Recharts | Completo |
| MOSAP3Pay Dashboard | `/mosap3pay` | `Mosap3Pay.tsx` | Supabase (pos_sales, suppliers) | Completo |
| MOSAP3Pay Fornecedores | `/mosap3pay/fornecedores` | `Mosap3PayFornecedores.tsx` | Supabase (suppliers, supplier_products, supplier_pos, supplier_provinces, patec_items) | Completo |
| MOSAP3Pay POS | `/mosap3pay/pos` | `Mosap3PayPOS.tsx`, `InvoicePDF` | Supabase (suppliers, supplier_products, farmers, pos_sales, pos_sale_items, stock_movements, invoice_sequences), Edge Function (unitel-money-payment) | Completo |
| MOSAP3Pay Vendas | `/mosap3pay/vendas` | `Mosap3PayVendas.tsx`, `InvoicePDF` | Supabase (pos_sales, pos_sale_items), Edge Functions (generate-saft, validate-saft) | Completo |
| MOSAP3Pay Notas Crédito | `/mosap3pay/notas-credito` | `Mosap3PayNotasCredito.tsx` | Supabase (credit_notes, credit_note_items) | Completo |
| MOSAP3Pay Stock | `/mosap3pay/stock` | `Mosap3PayStock.tsx` | Supabase (supplier_products, stock_movements) | Completo |
| MOSAP3Pay Relatórios | `/mosap3pay/relatorios` | `Mosap3PayRelatorios.tsx` | Supabase (pos_sales, credit_notes), Recharts | Completo |
| MOSAP3Pay Auditoria | `/mosap3pay/auditoria` | `Mosap3PayAuditLogs.tsx` | Supabase (audit_logs) | Completo |
| MOSAP3Pay Configurações | `/mosap3pay/configuracoes` | `Mosap3PayConfiguracoes.tsx` | Supabase (system_settings) | Completo |
| Utilizadores | `/utilizadores` | `Utilizadores.tsx` | Supabase (profiles, user_roles, user_provinces, user_ecas) | Completo |
| Perfis (Matriz RBAC) | `/perfis` | `Perfis.tsx` | Supabase (module_permissions) | Completo |
| Configurações Gerais | `/configuracoes` | `Configuracoes.tsx` | Supabase (system_settings, profiles, provinces) | Completo |
| Gestão Províncias | `/provincias` | `GestaoProvincias.tsx` | Supabase (provinces, municipalities, schools) | Completo |
| Instalar (PWA) | `/instalar` | `Instalar.tsx` | Service Worker, Web Push API | Completo |
| Notificações | (global) | `NotificationBell.tsx`, `useNotifications` | Supabase (notifications), Edge Function (send-push-notification) | Completo |

## Portal do Fornecedor

| Módulo | Rota(s) | Componentes principais | Dependências externas | Estado |
|---|---|---|---|---|
| Auth Fornecedor | `/fornecedor/login` | `FornecedorAuth.tsx` (wizard 3 passos, multi-loja) | Supabase Auth, Supabase (suppliers, supplier_stores) | Completo |
| Dashboard | `/fornecedor` | `FornecedorDashboard.tsx` | Supabase (supplier_products, supplier_pos, pos_sales) | Completo |
| Produtos | `/fornecedor/produtos` | `FornecedorProdutos.tsx` | Supabase (supplier_products) | Completo |
| Stock | `/fornecedor/stock` | `FornecedorStock.tsx` | Supabase (supplier_products, stock_movements) | Completo |
| POS Terminais | `/fornecedor/pos` | `FornecedorPOS.tsx` | Supabase (supplier_pos) | Completo |
| Vendas | `/fornecedor/vendas` | `FornecedorVendas.tsx` | Supabase (pos_sales) | Completo |
| Lojas | `/fornecedor/lojas` | `FornecedorLojas.tsx` | Supabase (supplier_stores, provinces, municipalities) | Completo |
| Perfil | `/fornecedor/perfil` | `FornecedorPerfil.tsx` | Supabase (suppliers), Storage (supplier-logos) | Completo |

## Edge Functions

| Função | Finalidade | Integrações | Estado |
|---|---|---|---|
| `generate-saft` | Exportação SAF-T (AO) XML | Supabase DB | Completo |
| `validate-saft` | Validação SAF-T contra esquema AGT | XML Schema v1.01_01 | Completo |
| `unitel-money-payment` | Pagamento Unitel Money API v4.7 | OAuth2 (BuyGoods) | Completo |
| `send-push-notification` | Web Push via VAPID | Web Push Protocol | Completo |
| `generate-vapid-keys` | Geração chaves VAPID | Crypto API | Completo |
| `seed-test-users` | Criação utilizadores de teste | Supabase Auth Admin | Completo |

## Infraestrutura Transversal

| Componente | Descrição | Estado |
|---|---|---|
| RBAC (9 níveis) | `user_roles` + `has_role()` + `RoleGuard` + `is_admin()` | Completo |
| Matriz Permissões | `module_permissions` com persistência DB, aplicada em RoleGuard/AppLayout/AppNavbar | Completo |
| RLS Policies | 30+ tabelas com Row-Level Security | Completo |
| PWA / Offline | Service Worker, IndexedDB cache (30m TTL), SyncQueue v3, login offline PBKDF2 | Completo |
| Compressão Imagens | Client-side (max 1024px, quality 0.7) | Completo |
| Notificações Híbridas | In-app (DB) + Web Push (VAPID) | Completo |
| Geolocalização | Leaflet vanilla + ArcGIS satellite | Completo |

## Resumo

- **Total de rotas**: 34 (25 backoffice + 8 portal fornecedor + 1 auth)
- **Tabelas Supabase**: 31 (inclui `module_permissions` e `supplier_stores`)
- **Edge Functions**: 6
- **Storage Buckets**: 2 (farmer-media privado, supplier-logos público)
- **Estado geral**: Todos os módulos estão **completos**, incluindo a Matriz de Permissões que agora tem persistência na base de dados.

---

Este inventário reflecte o estado actual da plataforma. Não são necessárias alterações de código -- trata-se apenas de documentação. Se pretender, posso gerar um PDF actualizado com este inventário.

