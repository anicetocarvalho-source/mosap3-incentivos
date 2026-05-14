## Objectivo

Criar testes automáticos de paridade entre o módulo de **Relatórios** (`useReportData`) e a **Lista de Agricultores** (`useFarmersList` / `applyFarmerScopeFilter`), garantindo que ambos partem do mesmo universo de produtores e que a regra "Removidos contam em todos os agregados" se mantém no tempo.

## Contexto

- `src/hooks/useReportData.ts` já não aplica `.neq("status","Removido")` em nenhum dos 5 relatórios (Produção, Pecuária, Agricultores, Incentivos, Compras).
- A Lista (`/agricultores`) continua a esconder Removidos por defeito (opt‑in via `includeRemoved`).
- Já existem `dashboard-list-parity.test.ts` e `financial-summary-parity.test.ts`. Falta cobrir Relatórios.

## Ficheiro novo: `src/test/reports-list-parity.test.ts`

Mock partilhado do cliente Supabase com dataset determinístico (~150 produtores em 3 províncias activas + 1 província só com Removidos), `farmer_parcels`, `farmer_production`, `livestock`, `livestock_production`, `farmer_incentives`, `farmer_transactions`. Os datasets reutilizam o helper já usado em `financial-summary-parity.test.ts` (mesma estrutura de mock chainable).

Casos de teste:

1. **Produção (`producao_provincia`)** inclui Removidos
   - Soma de `agricultores` em todas as linhas == total da Lista com `includeRemoved: true`.
   - Província só com Removidos aparece no relatório com `agricultores > 0`.

2. **Pecuária (`pecuaria_provincia`)** inclui Removidos
   - Produtores únicos com livestock incluem códigos de Removidos.

3. **Agricultores por estado (`agricultores_estado`)**
   - `Σ row.total` == Lista com `includeRemoved: true`.
   - `Σ row.total` − Lista com `includeRemoved: false` == nº de Removidos.
   - Filtro `estado = "Removido"` devolve apenas Removidos e bate com Lista filtrada por status.

4. **Incentivos (`incentivos_distribuidos`)**
   - `Σ beneficiarios` ⊆ universo de produtores incluindo Removidos.
   - `Σ totalKz` == soma directa dos `farmer_incentives.amount` no mock (sem exclusão).

5. **Compras (`compras_transacoes`)**
   - `Σ transacoes` e `Σ volumeKz` == totais directos do mock, incluindo transacções de Removidos.

6. **Cross‑source: Relatórios vs Lista (admin global)**
   - `fetchAgricultores({all})` total == `useFarmersList({includeRemoved:true})` count.
   - `fetchAgricultores({all}).total − useFarmersList({includeRemoved:false}).count == nº Removidos`.

7. **Filtro geográfico cascata**
   - `fetchAgricultores({provincia:"Huíla"})` == Lista filtrada por `province=Huíla` (com Removidos).

8. **Guarda‑costas anti‑regressão**
   - Inspecciona o código fonte de `useReportData.ts` (lê o ficheiro com `fs`) e falha se reaparecer `.neq("status", "Removido")` em qualquer das 5 funções `fetch*`. Isto trava reintroduções acidentais mesmo sem dados.

## Pequena extensão: `src/test/dashboard-list-parity.test.ts`

Adicionar 1 teste cruzado:
- `dashboard_kpis.total_farmers` == `Σ fetchAgricultores().total` (relatório agricultores_estado sem filtros).

## O que **não** muda

- Sem alterações a `useReportData.ts`, `useFinancialSummary.ts`, `EcaBalanceTable.tsx` ou a qualquer componente de UI/SQL/RLS.
- Sem alterações às páginas que legitimamente excluem Removidos (`Producao.tsx`, `Parcelas.tsx`, `Incentivos.tsx`, `Mosap3PayCartoesSim.tsx`, `useEscolasAuditoria.ts`, `useSchoolDetail.ts`, `Agricultores.tsx`) — são selectors/dropdowns ou auditorias ECA, fora do âmbito de agregados financeiros/produtivos.

## Resultado esperado

- 8 novos testes em `reports-list-parity.test.ts` + 1 cruzado em `dashboard-list-parity.test.ts`.
- Suíte total: 33 → ~42 testes, todos a passar.
- Qualquer reintrodução futura de `.neq("status","Removido")` em `useReportData.ts` falha imediatamente em CI.