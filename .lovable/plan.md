

## Plano

### 1. RPC `dashboard_kpis` — adicionar parâmetros de período

Novos parâmetros opcionais: `p_from date`, `p_to date`. Quando `NULL`, comportamento actual (sem filtro de data). Quando definidos, cada agregado usa a sua **data de negócio** com fallback para `created_at`:

| Tabela | Campo de data |
|---|---|
| `farmers` | `created_at` |
| `farmer_transactions` | `COALESCE(NULLIF(transaction_date,'')::date, created_at::date)` |
| `farmer_parcels` | `created_at` |
| `farmer_production` | `COALESCE(NULLIF(planted_date,'')::date, created_at::date)` |
| `livestock` | `created_at` |
| `pos_sales` | `created_at` |
| `farmer_incentives` | `COALESCE(NULLIF(incentive_date,'')::date, created_at::date)` |

Para `valor_recebido` / `total_gasto` (campos cumulativos no `farmers`): no período, soma a partir de `farmer_incentives.amount` (recebido) e `farmer_transactions.valor` (gasto). Sem período, mantém comportamento actual (campos do `farmers`).

`suppliers`, `schools`, `supplier_products` (stock crítico): não filtram por período (estado actual).

### 2. RPC `dashboard_kpis_yoy` — nova função

Recebe os mesmos parâmetros + período. Devolve `{ current: jsonb, previous: jsonb, deltas: jsonb }`:
- `current` = `dashboard_kpis(scope, from, to)`
- `previous` = `dashboard_kpis(scope, from - 1y, to - 1y)`
- `deltas` = % por KPI: `(current - previous) / NULLIF(previous,0) * 100`, arredondado a 1 casa. `null` quando `previous = 0`.

Sem período definido, devolve só `current` com `deltas = null` (sem badge).

### 3. Hook `useDashboardKpis(period?)`

- Aceita `{ from?: Date; to?: Date }`.
- `queryKey` inclui `from`/`to`.
- Quando ambos definidos, chama `dashboard_kpis_yoy`; senão `dashboard_kpis` simples.
- Expõe `data.deltas` (mapa `kpi -> number | null`).

### 4. UI `Dashboard.tsx`

- Novo `PeriodFilter` (componente novo) no topo do hero — date range picker shadcn (Popover + Calendar `mode="range"`) com:
  - Botões rápidos: "Limpar", "Mês actual", "Trimestre actual", "Ano actual"
  - Label dinâmico mostra intervalo seleccionado
- Por defeito **vazio** (sem filtro) — comportamento actual mantido.
- `KpiCard` ganha prop opcional `delta?: number | null` que renderiza badge à direita do valor:
  - `↑ +12,3%` em verde (`success`) se >0
  - `↓ -5,1%` em vermelho (`destructive`) se <0
  - `–` cinzento se =0
  - escondido se `null`/undefined
- Todos os 12 KPI cards numéricos passam `delta={kpis.deltas?.xxx ?? null}`.

### 5. Charts

Não tocar os charts (escopo: filtro YoY nos KPIs). Os charts continuam globais — manter consistência visual sem complicar a primeira iteração.

### Ficheiros

1. **Migração SQL** — actualiza `dashboard_kpis` (params from/to) + nova `dashboard_kpis_yoy`.
2. `src/hooks/useDashboardData.ts` — aceitar período, novo retorno com `deltas`.
3. `src/components/dashboard/PeriodFilter.tsx` (novo).
4. `src/components/dashboard/KpiCard.tsx` — prop `delta`.
5. `src/pages/Dashboard.tsx` — estado de período, filtro no topo, passar `delta` aos cards.

