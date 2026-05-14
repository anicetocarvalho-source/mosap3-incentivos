## Objectivo

Alinhar todos os agregados financeiros e de relatórios com o Dashboard global (15.166 agricultores, incluindo Removidos) e travar futuras divergências com testes automáticos.

## 1. Alinhar código (remover exclusão de Removidos)

| Ficheiro | Linha(s) a alterar | Mudança |
|---|---|---|
| `src/hooks/useFinancialSummary.ts` | 55 | Remover `.neq("status","Removido")` e actualizar JSDoc (linha 40). |
| `src/components/dashboard/EcaBalanceTable.tsx` | 43, 65 | Remover ambos os `.neq("status","Removido")` (lista de províncias e agregação por ECA). |
| `src/hooks/useReportData.ts` | 41, 100, 162, 193, 233 | Remover os 5 `.neq("status","Removido")`. |

Resultado: cards de resumo financeiro, tabela de saldos por ECA e Relatórios passam a contar 15.166 produtores, batendo com o Dashboard e a Lista.

## 2. Novos testes de paridade

Ficheiro novo: `src/test/financial-summary-parity.test.ts`

Mock do cliente Supabase com um dataset partilhado (~150 produtores: 138 activos em 3 províncias + 14 Removidos numa 4ª província) e estes casos:

1. **`useFinancialSummary` por província** — soma de `recebido`/`gasto`/`saldo` igual à soma directa do dataset filtrado por essa província **incluindo Removidos**.
2. **`useFinancialSummary` por ECA** — mesma regra com filtro `school` (ilike).
3. **Sem filtros** — hook devolve `EMPTY` (regra actual mantém-se).
4. **`EcaBalanceTable`** — agregação por escola dentro de uma província conta Removidos; total das linhas == nº de produtores da Lista nessa província.
5. **`useReportData` (`farmersByProvince`)** — totais por província batem com a contagem da Lista (Removidos incluídos).

Ficheiro a estender: `src/test/dashboard-list-parity.test.ts`

Adicionar 2 testes cross-source:

6. **Lista (admin) vs `useFinancialSummary` global** — soma agregada por todas as províncias do hook == total da Lista.
7. **`dashboard_kpis.total_recebido` vs soma de `useFinancialSummary` em todas as províncias** — diferença = 0 (única fonte de verdade financeira).

## 3. Memória do projecto

Adicionar uma core rule curta em `mem://index.md`:

> "Removidos são contados em TODOS os agregados (Dashboard, financeiros, Relatórios, ECA). Nunca usar `.neq('status','Removido')` em queries de contagem/soma. Excepção: lista de produtores por defeito esconde Removidos (reciclagem)."

## Detalhes técnicos

- O mock do Supabase segue o padrão já existente em `src/test/dashboard-list-parity.test.ts` (`vi.mock` com `get supabase()` para evitar problemas de hoisting).
- Não toca em SQL — as funções `dashboard_kpis`/`dashboard_charts` já incluem Removidos (migration anterior).
- `useFarmersList` mantém comportamento actual (`includeRemoved` opt-in). Só os hooks de **agregação** mudam.
- Não altera RLS, autenticação nem layouts.

## O que NÃO muda

- `recalc_school_farmer_counts`, `recalc_school_for_name`, `detect_farmer_anomalies` — continuam a excluir Removidos (regra de negócio das ECAs).
- Página `/agricultores` continua a mostrar Removidos com opacidade reduzida e botão Restaurar.
- Nenhuma mudança visual ou de UX.

## Resultado esperado

| Indicador | Antes | Depois |
|---|---|---|
| Dashboard `total_farmers` | 15.166 | 15.166 |
| Lista de Agricultores | 15.166 | 15.166 |
| Cards financeiros por província | 13.803 | **15.166** |
| Tabela Saldos por ECA | só activos | **inclui Removidos** |
| Relatórios | só activos | **inclui Removidos** |
| Testes de paridade | 5 | **12** |
