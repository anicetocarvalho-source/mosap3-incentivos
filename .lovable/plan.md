

# Plano de Melhorias Globais da Plataforma MOSAP3

Foram identificados problemas em 4 categorias: bugs de runtime, segurança da base de dados, qualidade de codigo, e robustez do sistema offline.

---

## 1. Corrigir Bug Critico: `useState` usado como `useEffect` no FarmerProfile

**Problema**: Em `FarmerProfile.tsx` (linha 71), `useState(() => { ... })` esta a ser usado como inicializador, o que executa queries Supabase no render -- potencialmente multiplas vezes, sem cleanup.

**Correcao**: Substituir por `useEffect` com dependencia em `id`.

---

## 2. Corrigir Erro de Runtime: IndexedDB "database connection is closing"

**Problema**: O `offlineDb.ts` mantém um singleton `dbInstance` que pode fechar inesperadamente (ex: tab em background, upgrade concorrente). Quando se tenta usar a conexao fechada, dá o erro.

**Correcao**: Adicionar handler `onclose` no `getDb()` que limpa `dbInstance = null`, e envolver chamadas criticas num try/catch que recria a conexao.

---

## 3. Corrigir Warning: "Function components cannot be given refs" no FarmerProfile

**Problema**: `Dialog` e `AlertDialog` (Radix) estao a receber refs de componentes funcionais sem `forwardRef`.

**Correcao**: Verificar e corrigir os componentes que sao passados como children directos desses primitivos.

---

## 4. Reforcar Seguranca RLS (Prioridade Alta)

O scan de seguranca identificou **39 findings**, incluindo 7 de severidade **error**. As tabelas com dados sensíveis (PII de agricultores, dados financeiros, logs de auditoria) estao acessiveis a qualquer utilizador autenticado.

### Migracao SQL para restringir politicas RLS:

**Tabelas afectadas e nova logica**:

| Tabela | Operacao | Politica actual | Nova politica |
|---|---|---|---|
| `farmers` | INSERT/UPDATE | `WITH CHECK (true)` / `USING (true)` | Restringir a `has_role(auth.uid(), role)` para roles com acesso ao modulo |
| `farmer_dependents` | INSERT/UPDATE | `true` | Restringir a utilizadores autenticados com role adequado |
| `farmer_transactions` | INSERT/UPDATE | `true` | Idem |
| `farmer_incentives` | INSERT/UPDATE | `true` | Idem |
| `farmer_parcels` | INSERT/UPDATE | `true` | Idem |
| `farmer_production` | INSERT/UPDATE | `true` | Idem |
| `farmer_production_phases` | INSERT/UPDATE | `true` | Idem |
| `audit_logs` | SELECT | `USING (true)` | Restringir a admins |
| `livestock` / `livestock_health` / `livestock_production` | INSERT/UPDATE | `true` | Restringir a authenticated com role |

**Abordagem**: Criar uma funcao `has_any_backoffice_role(uuid)` que verifica se o utilizador tem pelo menos uma role do backoffice. Usar esta funcao nas politicas INSERT/UPDATE em vez de `true`. Para SELECT de dados sensíveis (audit_logs), restringir a admins.

> **Nota**: Muitas destas tabelas necessitam que qualquer utilizador do backoffice (com qualquer role) possa inserir/editar -- o objectivo e apenas bloquear utilizadores sem role (ex: fornecedores que registam conta mas nao devem aceder a dados de agricultores).

---

## 5. Melhorar Robustez do ErrorBoundary

**Melhoria**: Adicionar botao "Voltar ao Dashboard" alem do "Recarregar", e usar os design tokens do sistema em vez de cores hardcoded (`bg-gray-50`, `bg-green-700`).

---

## 6. Melhorar Gestao de Estado no offlineDb

**Melhoria**: Adicionar `db.onclose` handler para invalidar o singleton quando a conexao fecha, evitando o erro de runtime reportado.

---

## Ficheiros a alterar

| Ficheiro | Alteracao |
|---|---|
| `src/pages/FarmerProfile.tsx` | `useState(() => {...})` -> `useEffect(() => {...}, [id])` |
| `src/lib/offlineDb.ts` | Adicionar `onclose` handler, try/catch com reconnect |
| `src/components/ErrorBoundary.tsx` | Usar design tokens, adicionar "Voltar ao Dashboard" |
| **Migracao SQL** | Criar `has_any_backoffice_role()`, actualizar ~20 politicas RLS |

## Estimativa

- Bug fixes (items 1-3, 5-6): rapido, 3 ficheiros
- Seguranca RLS (item 4): 1 migracao SQL com ~40 statements

