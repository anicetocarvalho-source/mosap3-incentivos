

## Diagnóstico

O `useDashboardData` puxa **dados em bruto** para o navegador e agrega em JS:
- `farmers` → ~10.905 linhas (11 páginas de 1.000)
- `farmer_transactions` → ~70.394 linhas (71 páginas de 1.000)
- `farmer_parcels`, `farmer_production`, `livestock`, `pos_sales` → também paginados
- Total: **~85+ requests HTTP** + 80+ MB de JSON + agregação no cliente.

Mesmo com paralelismo de 12, isto demora vários segundos e bloqueia o thread principal nas reduções (`reduce`, `Set`, etc.).

## Solução: agregar em SQL, devolver linhas pequenas

Criar **funções RPC** em Postgres (`SECURITY DEFINER`) que devolvem JSON já agregado, respeitando o âmbito geográfico do utilizador (global / província / ECA). O hook passa a fazer ~3 chamadas leves em vez de ~85 pesadas.

### 1. Migração SQL — funções e índices

**Índices** (acelera filtros e agregações):
```
idx_farmers_province        (province)
idx_farmers_school          (school)
idx_farmers_status          (status)
idx_tx_farmer_code          (farmer_code)
idx_parcels_farmer_code     (farmer_code)
idx_production_farmer_code  (farmer_code)
idx_livestock_farmer_id     (farmer_id)
idx_pos_sales_created_at    (created_at)
idx_pos_sales_farmer_code   (farmer_code)
```

**RPC `dashboard_kpis(p_scope, p_provinces, p_ecas)`** — devolve um único JSONB com:
- `total_farmers`, `total_approved`, `total_companies`, `total_schools`
- `total_parcels`, `total_area_ha`, `total_production`, `total_livestock`, `total_livestock_producers`
- `total_recebido`, `total_gasto`, `utilization_rate`, `avg_yield_per_ha`, `critical_stock_count`
- `total_transactions`, `volume_transactions`, `total_reconciliado`

**RPC `dashboard_charts(p_scope, p_provinces, p_ecas)`** — devolve JSONB com:
- `farmers_by_province`, `gender_data`
- `transactions_by_province`, `production_by_culture`, `livestock_by_species`
- `pos_sales_trend` (últimos 12 meses, agregado por mês via `date_trunc`)

Toda a aritmética de `valor_recebido`/`total_gasto`/`valor` (formato pt-AO `"199.500,00"`) feita com `replace(replace(x,'.',''),',','.')::numeric` em SQL.

### 2. Refactor do hook (`src/hooks/useDashboardData.ts`)

Substituir as ~85 paginações por:
```ts
const { data: kpis } = await supabase.rpc('dashboard_kpis', { p_scope, p_provinces, p_ecas });
const { data: charts } = await supabase.rpc('dashboard_charts', { p_scope, p_provinces, p_ecas });
```

Manter o mapping para a interface `DashboardStats` existente (zero mudanças no `Dashboard.tsx`).

### 3. UX progressiva (equilíbrio pedido)

- Dividir em **2 queries React Query** com `queryKey` distintas: `["dashboard-kpis", …]` e `["dashboard-charts", …]`.
- KPIs aparecem assim que o RPC `dashboard_kpis` responde (~tipicamente <1s).
- Cada `ChartCard` mostra `Skeleton` enquanto `dashboard_charts` carrega (sem bloquear o ecrã).
- Hero usa volume dos KPIs.

### 4. Cache

- `staleTime: 5min` (mantém-se).
- Adicionar `gcTime: 10min`.

## Resultado esperado

- De **~85 requests + ~80MB** para **2 requests + alguns KB**.
- Tempo de carga: de muitos segundos → tipicamente <1.5s para KPIs.
- Mantém RLS e filtragem geográfica intactas.

## Ficheiros tocados

1. **Migração SQL** (nova) — índices + 2 funções RPC.
2. `src/hooks/useDashboardData.ts` — substituir fetch por chamadas RPC; expor `useDashboardKpis()` + `useDashboardCharts()`.
3. `src/pages/Dashboard.tsx` — consumir os dois hooks; adicionar Skeletons aos `ChartCard` enquanto charts carregam.

Sem alterações de schema nem em outras páginas.

