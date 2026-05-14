## Página de Estado dos Cartões SIM

Nova página em `/mosap3pay/cartoes-sim` para acompanhar o estado dos cartões SIM (Activo, Removido, Barrado, Pré desactivado) sincronizado com o ficheiro Unitel `ALL_MOSAP_*.xlsx` e com edição manual.

### 1. Base de dados

**Coluna nova em `farmers`**
- `sim_status text` — valores: `Activo`, `Removido`, `Barrado`, `Pré desactivado`, `Desconhecido` (default).
- `sim_status_updated_at timestamptz` — última actualização.
- `sim_status_source text` — `reconciliacao` ou `manual`.

**Tabela nova `sim_status_history`**
- `farmer_code`, `phone`, `old_status`, `new_status`, `source` (`reconciliacao` / `manual`), `notes`, `changed_by`, `created_at`.
- RLS: Admin + Gestor de Incentivos podem ler/inserir; Admin pode apagar.
- Trigger `on_sim_status_changed`: quando `farmers.sim_status` muda, insere linha no histórico e cria notificação para o gestor de província.

### 2. Reconciliação MOSAP3Pay (já existente)

Adicionar uma 5.ª aba **"Estado SIM"** ao `/mosap3pay/reconciliacao`:
- Mostra `Estado_Numero` do Excel vs `sim_status` da BD, lado a lado.
- Mesmo padrão das restantes abas (checkbox, "Aplicar seleccionados", blocos de 50).
- Ao aprovar, escreve `sim_status`, `sim_status_source='reconciliacao'` e o trigger encarrega-se do histórico.

### 3. Página `/mosap3pay/cartoes-sim`

**RBAC:** `admin` e `gestor_incentivos` (mesmo da Reconciliação).

**KPIs no topo (4 cartões coloridos):**
- Activos (verde) · Pré desactivado (amarelo) · Barrado (laranja) · Removido (vermelho) · Desconhecido (cinza).

**Filtros:** província, município, escola, estado SIM, pesquisa por telefone/nome/código. Paginação de 50, exporta CSV.

**Tabela (desktop) / cards (mobile):**
Telefone · Nome · Província / Município · Escola · Estado SIM (badge colorido) · Última alteração · Acções.

**Acções por linha:**
- "Alterar estado" → diálogo com select dos 5 estados + campo de notas. Marca `sim_status_source='manual'`, regista no audit_logs e dispara o trigger de histórico.
- "Ver histórico" → drawer com timeline (data, antigo → novo, fonte, autor, notas).

### 4. Bloqueio no POS

No `Mosap3PayPOS.tsx` e `fornecedor/FornecedorPOSVenda.tsx`, ao identificar o agricultor:
- Se `sim_status` ∈ {`Barrado`, `Removido`}: alerta vermelho **"SIM bloqueado — venda não permitida"**, botão de pagamento desactivado.
- Se `sim_status = 'Pré desactivado'`: aviso amarelo **"SIM em pré-desactivação"**, venda permitida mas registada em `audit_logs` com flag.
- Se `Activo` ou `Desconhecido`: comportamento actual.

### 5. Notificações

Trigger `on_sim_status_changed` cria notificação via `notify_all_users` filtrando por gestores da província do agricultor:
- Categoria `cartoes_sim`, título "Cartão SIM alterado", corpo com nome do agricultor e novo estado.

### 6. Navegação

Adicionar entrada **"Cartões SIM"** no `AppNavbar.tsx` debaixo de **MOSAP3Pay**, ao lado de "Reconciliação", com ícone `Smartphone` (lucide).

### 7. Ficheiros afectados

```text
NOVOS:
  src/pages/Mosap3PayCartoesSim.tsx
  src/components/cartoes-sim/SimStatusBadge.tsx
  src/components/cartoes-sim/EditarSimStatusDialog.tsx
  src/components/cartoes-sim/SimStatusHistoryDrawer.tsx
  src/hooks/useSimCardsList.ts

EDITADOS:
  src/App.tsx                              (rota nova)
  src/components/AppNavbar.tsx             (link)
  src/lib/reconciliation.ts                (computeDiffs → simStatusDiffs)
  src/pages/Mosap3PayReconciliacao.tsx     (nova aba)
  src/pages/Mosap3PayPOS.tsx               (bloqueio)
  src/pages/fornecedor/FornecedorPOSVenda.tsx (bloqueio)

MIGRAÇÃO SQL:
  - ALTER TABLE farmers ADD COLUMN sim_status, sim_status_updated_at, sim_status_source
  - CREATE TABLE sim_status_history + RLS + trigger
```

### 8. Verificação

- Carregar `ALL_MOSAP_003.xlsx` em /mosap3pay/reconciliacao → confirmar que aba "Estado SIM" mostra os 826 Removidos + 2 158 Barrados; aplicar uma amostra e ver os contadores na nova página.
- Editar manualmente um SIM → confirmar entrada em `sim_status_history` e notificação ao gestor.
- Tentar venda no POS para agricultor com `Barrado` → botão pagar deve estar desactivado.

### Notas técnicas

- A coluna `farmers.status` (estado do agricultor: Pendente/Aprovado/Removido) **não é tocada** — `sim_status` é um eixo independente.
- Histórico mantido indefinidamente; sem rotação.
- A reconciliação continua a tratar `Estado_Numero='Removido'` como soft-delete do agricultor (comportamento actual) **e** actualiza `sim_status` em paralelo.
