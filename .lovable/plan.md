## Diagnóstico

Confirmei na BD: **15.166 agricultores** todos com `sim_status = 'Desconhecido'`. O ficheiro Excel `ALL_MOSAP_003-2.xlsx` (folha **"Detalhe"**) traz exactamente **15.166 linhas** com a coluna **STATUS** preenchida:

- `Activo` → 13.741
- `Pendente` → 1.425

A página `/mosap3pay/cartoes-sim` mostra tudo "Desconhecido" porque os dados nunca foram importados. Além disso, exclui Removidos (linha 63: `excludeEq: { column: "status", value: "Removido" }`) — viola a regra de Core "Removidos contam em todos os agregados".

A constraint actual de `sim_status` é `('Activo','Removido','Barrado','Pré desactivado','Desconhecido')` — não inclui `Pendente`, que é o valor real devolvido pelo operador para 1.425 SIMs.

## Plano

### 1. Migration — alargar enum de `sim_status`

- Adicionar `'Pendente'` à `farmers_sim_status_check`.
- Actualizar `farmers_sim_kpis()` RPC para devolver também `pendente` e contar TODOS os agricultores (sem `.neq Removido`, já é o caso).

### 2. Importação do Excel para a BD (one-shot via insert tool)

- Copiar `ALL_MOSAP_003-2.xlsx` para `/tmp`, ler folha "Detalhe", extrair `MSISDN` + `STATUS`.
- Gerar `UPDATE public.farmers SET sim_status = ?, sim_status_source = 'operadora_unitel', sim_status_updated_at = now() WHERE phone = ?` em blocos de 50 (regra Core).
- Estados aceites: `Activo`, `Pendente`. Qualquer outro → `Desconhecido`.
- Trigger existente `on_sim_status_changed` regista automaticamente em `sim_status_history` cada alteração.
- Reportar no fim: nº de matches, nº de telefones do Excel sem agricultor correspondente, contagem final por estado.

### 3. Frontend — `src/pages/Mosap3PayCartoesSim.tsx`

- **Remover** `excludeEq: { column: "status", value: "Removido" }` (linha 63) → tabela passa a mostrar 15.166.
- **Remover** `.neq("status", "Removido")` no `exportCsv` (linha 98).
- Adicionar KPI card **"Pendente"** (5→6 cards, ajustar grid para `md:grid-cols-6`).
- Adicionar `'Pendente'` em `SIM_STATUSES` (`src/lib/reconciliation.ts`).
- Adicionar variante `'Pendente'` em `SimStatusBadge` (cor `warning`).

### 4. Validação

- Query final: `select sim_status, count(*) from farmers group by 1` → soma deve dar 15.166.
- Página deve mostrar "15 166 resultados" no rodapé e os 6 KPIs devem somar 15.166.

## Fora de âmbito

- Não mexer em `useReportData`, financeiros, Dashboard global (já alinhados na sessão anterior).
- Não tocar em RLS nem auth.
- Não alterar lógica de reconciliação (`src/lib/reconciliation.ts` para além do enum).