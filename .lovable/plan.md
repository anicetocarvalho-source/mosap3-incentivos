## Objectivo

Garantir que **todos os cards e gráficos** do `/` (Dashboard) reflectem fielmente o que existe nos módulos (Agricultores, Transações, Fornecedores, Escolas, Parcelas, Pecuária, Incentivos), e adicionar os cards em falta.

## Diagnóstico actual (admin, âmbito global)

Após inspeccionar `dashboard_kpis` e `dashboard_charts` na BD, os valores devolvidos são:

| KPI | Valor RPC | Valor real na BD | Estado |
|---|---|---|---|
| Produtores | 10.905 | 10.905 | ✅ |
| Transações | 70.394 | 70.394 | ✅ |
| Fornecedores | 13 (`status='Ativo'`) | 13 totais | ⚠️ filtro restritivo |
| Escolas/ECAs | 733 (tabela `schools`) | 681 com produtores | ⚠️ inconsistente |
| Parcelas | 0 | 0 (tabela vazia) | ✅ mas sem aviso |
| Pecuária | 0 | 0 (tabela vazia) | ✅ mas sem aviso |
| Vendas POS | 0 | 0 (tabela vazia) | ✅ mas sem aviso |
| Género (M/F) | 0% / 0% | todos NULL | ⚠️ campo vazio |

**Cards/secções em falta no Dashboard que existem nos módulos:**
- Nº de **Transações** (só aparece como subtítulo do "Volume POS")
- Nº de **ECAs/Escolas de Campo** (não tem card próprio)
- Nº de **Municípios cobertos**
- Nº de **Incentivos atribuídos** (registos em `farmer_incentives`)
- Nº de **Notas de Crédito** emitidas
- Nº de **PATEC distribuídos** (1/2/3) e **sem PATEC**

## Alterações

### 1. Migração SQL — corrigir RPCs

Editar `dashboard_kpis` e `dashboard_charts`:

- `total_companies` → contar **todos** os fornecedores (remover filtro `status='Ativo'`); adicionar `total_companies_active` separado.
- `total_schools` → contar `DISTINCT school` em `farmers` (apenas ECAs com produtores), conforme escolha do utilizador.
- Adicionar novos campos ao JSON de retorno:
  - `total_municipalities` (DISTINCT municipality em farmers)
  - `total_incentives_count` (count `farmer_incentives`)
  - `total_credit_notes` (count `credit_notes`)
  - `total_patec_1`, `total_patec_2`, `total_patec_3`, `total_sem_patec`
- Em `dashboard_charts`, recalcular `gender_data` para distinguir entre "Sem registo" e zeros reais (devolver também `total_no_gender`).

### 2. Front-end (`src/pages/Dashboard.tsx` + `useDashboardData.ts`)

- Estender interface `DashboardKpis` com os novos campos.
- Criar nova secção **"Cobertura Operacional"** com 4 cards:
  - Transações (contagem) — link `/transacoes`
  - ECAs activas — link `/escolas-campo`
  - Municípios cobertos — link `/dashboard`
  - Incentivos atribuídos — link `/incentivos`
- Adicionar secção **"Distribuição PATEC"** (mini-cards 1/2/3/Sem) — link `/patec`.
- Reordenar "Visão Geral" para incluir Fornecedores Activos vs Total.

### 3. Aviso "Sem dados" nos cards a 0

Criar variante visual no `KpiCard` (badge cinzento "sem dados registados" + ícone `Info`) para cards cujo valor é 0 **e** o módulo subjacente está realmente vazio. Aplicar a Parcelas, Pecuária, Vendas POS, Produção, Género.

### 4. Validação cruzada

Adicionar pequeno componente `DataIntegrityBanner` (apenas para admin) no topo do dashboard que faz contagens directas (`SELECT count(*)`) às tabelas-chave e compara com os valores RPC. Se houver divergência > 1%, mostra aviso amarelo com detalhes (ajuda a diagnosticar caches do React Query).

### 5. Refresh manual

Adicionar botão "Actualizar dados" no `HeroHeader` que invalida `dashboard-kpis` e `dashboard-charts` no React Query (`staleTime` actual é 5min).

## Ficheiros afectados

- `supabase/migrations/<novo>.sql` — RPCs `dashboard_kpis` + `dashboard_charts`
- `src/hooks/useDashboardData.ts` — extensão da interface + mapping
- `src/pages/Dashboard.tsx` — novas secções + variante "sem dados"
- `src/components/dashboard/KpiCard.tsx` — variante `emptyState`
- `src/components/dashboard/HeroHeader.tsx` — botão refresh
- `src/components/dashboard/DataIntegrityBanner.tsx` — **novo**

## Notas

- A escolha "Apenas ECAs com produtores" será aplicada também em qualquer KPI relacionado.
- Cards sem dados ficam visíveis com aviso ("Mostrar 0 com aviso").
- Os campos `gender` e tabelas `farmer_parcels`/`livestock`/`pos_sales` estão genuinamente vazios — isto não é bug, mas o dashboard passará a comunicá-lo claramente.
