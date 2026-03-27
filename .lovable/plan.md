

## Revisão Completa da Plataforma MOSAP3 — Preparação para Produção

Após análise detalhada do código, base de dados, autenticação, fluxos e configurações, segue o relatório organizado por área.

---

### 1. PROBLEMAS A CORRIGIR (Prioritários)

#### 1.1 Página 404 em inglês
- `NotFound.tsx` mostra "Oops! Page not found" em vez de português. Deve dizer "Página não encontrada" com link "Voltar ao Início".

#### 1.2 Incentivos — join com FK inexistente
- `Incentivos.tsx` usa `farmers!farmer_incentives_farmer_code_fkey(...)` mas a tabela `farmer_incentives` **não tem foreign keys**. Isto pode causar erros. Deve ser um join manual ou criar a FK na base de dados.

#### 1.3 Falta de `ErrorBoundary` global
- Não existe um ErrorBoundary React. Se qualquer componente falhar, a app inteira fica em branco. Adicionar um ErrorBoundary com UI de fallback em português.

#### 1.4 Registo público de utilizadores aberto
- A página `/auth` permite registo (`signUp`) sem restrições. Em produção, qualquer pessoa pode criar conta. Considerar desactivar o registo público ou exigir aprovação de admin.

#### 1.5 Formulário de Incentivos sem código sequencial automático
- O `incentive_code` é gerado manualmente como `INC-XXXX` com random. Em produção, deveria ser sequencial para rastreabilidade.

#### 1.6 PWA sem ícones reais
- `vite.config.ts` referencia `pwa-192x192.png` e `pwa-512x512.png` mas estes ficheiros podem não existir em `/public`. Verificar e adicionar.

---

### 2. SEGURANÇA

#### 2.1 RLS — Avaliação OK com ressalvas
- Todas as tabelas têm RLS activo. A maioria segue o padrão correcto (admins gerem, autenticados inserem/visualizam).
- **Ressalva**: `notifications` não permite INSERT por utilizadores — apenas triggers internos. Correcto.
- **Ressalva**: `farmer_documents` não permite UPDATE — aceitável.
- **Ressalva**: `profiles` não permite INSERT por utilizadores normais — o trigger `handle_new_user` cria automaticamente. Correcto.

#### 2.2 Credenciais Unitel Money
- Armazenadas em `system_settings` com visibilidade para todos os autenticados (SELECT). As chaves de API ficam expostas a qualquer utilizador logado. **Recomendação**: mover credenciais sensíveis para secrets da Edge Function ou criar política RLS restrita para chaves `unitel_*`.

#### 2.3 Fornecedor — registo sem verificação de email
- `FornecedorAuth.tsx` faz `signUp` e depois insere em `suppliers` directamente. Se o auto-confirm estiver activo, a conta fica imediatamente acessível.

---

### 3. FLUXOS VALIDADOS (Funcionais)

| Fluxo | Estado |
|-------|--------|
| Login / Logout (online + offline) | ✅ OK |
| RBAC com 9 perfis + RoleGuard | ✅ OK |
| Registo de agricultores (online + offline) | ✅ OK |
| Edição inline no perfil do agricultor | ✅ OK |
| Remoção / restauro de agricultores | ✅ OK |
| PATEC — atribuição individual e bulk | ✅ OK |
| Parcelas, produção, dependentes, transações | ✅ OK |
| Escolas de campo com mapa interactivo | ✅ OK |
| Gestão territorial (províncias/municípios) | ✅ OK |
| Cascata Província → Município em formulários | ✅ OK |
| POS com kiosk, facturas fiscais, QR | ✅ OK |
| Notas de crédito com ajuste de saldo | ✅ OK |
| SAF-T AO exportação e validação | ✅ OK |
| Stock movements e alertas | ✅ OK |
| Portal do fornecedor isolado | ✅ OK |
| Relatórios com filtros e impressão | ✅ OK |
| Notificações e push subscriptions | ✅ OK |
| Sincronização offline (IndexedDB + auto-sync) | ✅ OK |
| Audit logs | ✅ OK |

---

### 4. MELHORIAS RECOMENDADAS (Não bloqueantes)

| Melhoria | Impacto |
|----------|---------|
| Adicionar loading skeleton no Dashboard enquanto carrega | UX |
| Limitar query de `pos_sales` e `farmers` a paginação server-side (actualmente carrega tudo) | Performance |
| Adicionar `<meta>` robots `noindex` se não quiser indexação | SEO |
| Traduzir mensagens do Supabase Auth (e.g. "Invalid login credentials") | UX |
| Adicionar rate-limiting ou captcha no login | Segurança |
| Verificar existência dos ficheiros PWA icons | PWA |

---

### 5. PLANO DE IMPLEMENTAÇÃO

Correcções a fazer num único ciclo:

1. **Traduzir `NotFound.tsx`** para português
2. **Adicionar `ErrorBoundary`** global com fallback em português
3. **Corrigir join de Incentivos** — usar `.select()` com join explícito ou verificar FK
4. **Mover credenciais Unitel** — adicionar RLS policy para `system_settings` que restrinja chaves `unitel_*` a admins apenas (o SELECT actual já permite a todos)
5. **Avaliar registo público** — adicionar flag ou desactivar tab de registo conforme decisão

### Detalhes Técnicos

- **ErrorBoundary**: Novo componente em `src/components/ErrorBoundary.tsx`, wrapping `<App>` em `main.tsx`
- **NotFound**: Alterar textos para PT-AO
- **Incentivos join**: A query usa uma FK hint que pode falhar. Mudar para `.select("*, farmers(full_name, phone, province, school)")` sem hint, ou adicionar migration para criar a FK real
- **system_settings RLS**: Adicionar policy que restrinja SELECT de chaves `unitel_*` apenas a admins via `is_admin(auth.uid())`, mantendo SELECT geral para outras settings
- **Registo**: Remover tab "Registar" de `Auth.tsx` (apenas admin cria utilizadores via `/utilizadores`), ou manter mas com nota de que a conta precisa de aprovação

