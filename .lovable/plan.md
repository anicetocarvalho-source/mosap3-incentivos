# Alinhar Dashboard com a lista de Agricultores

## Objetivo
Fazer o Dashboard contar todos os 15.166 agricultores (incluindo os 1.363 com `status = 'Removido'`), batendo certo com o total mostrado na página Agricultores.

## Causa atual
As funções `dashboard_kpis` e `dashboard_charts` (no Supabase) filtram em todo o lado por `COALESCE(status,'') <> 'Removido'`. Isso gera o total de 13.803, contra os 15.166 da lista.

## Alterações (apenas SQL via migration)

Remover a exclusão de `'Removido'` em todas as agregações de KPIs e gráficos do dashboard:

1. **`public.dashboard_kpis`** — eliminar o `<> 'Removido'` em:
   - CTE `scoped` (base de produtores, género, escolas, municípios, PATEC)
   - sub-queries de `farmer_incentives`, `farmer_transactions`, `farmer_parcels`, `farmer_production`, `livestock`
   - bloco "ELSE" do recebido/gasto agregado

2. **`public.dashboard_charts`** — eliminar o `<> 'Removido'` em:
   - `farmers_by_province`, `gender_data`
   - `transactions_by_province`, `production_by_culture`, `livestock_by_species`, `pos_sales_trend`

3. Manter o filtro de scope geográfico (província/ECA) intacto.

## O que NÃO muda

- `recalc_school_farmer_counts`, `recalc_school_for_name` e `detect_farmer_anomalies` continuam a excluir Removidos (faz sentido: contagem oficial das ECAs e anomalias não devem incluir fichas removidas).
- Lista de Agricultores continua a mostrar Removidos com opacidade reduzida e botão Restaurar (sem alterações).
- Hook `useFarmersList` e `applyFarmerScopeFilter` continuam com a regra atual (cada página decide via `includeRemoved`).

## Resultado esperado

| Indicador | Antes | Depois |
|---|---|---|
| Total Agricultores (Dashboard) | 13.803 | **15.166** |
| Total Agricultores (Lista) | 15.166 | 15.166 |
| Total ECAs (escolas), produção, pecuária | só ativos | passam a incluir Removidos |
| Anomalias / contagens nas ECAs | só ativos | só ativos (inalterado) |

## Aviso

Incluir Removidos no Dashboard significa que os KPIs financeiros (recebido, gasto), produção e pecuária passam a somar também valores de fichas que foram marcadas como removidas. Se preferir manter os indicadores financeiros/produtivos só com ativos e mudar apenas a contagem de produtores, diga-me e ajusto o plano para alterar exclusivamente a CTE `scoped` (deixando incentivos/transações/produção/pecuária com o filtro atual).
