
User asks two things — pure Q&A, no code changes needed. But there's also a runtime error `n.toLocaleString` on undefined that I should silently fix as part of this turn since it's likely from the new dashboard cards I added.

Let me check the dashboard quickly to answer accurately and locate the toLocaleString issue.

Answers:
1. **Card "Empresas"** — currently counts `uniqueEmpresas` from `farmer_transactions.empresa` (distinct companies that have transacted with farmers). It does represent suppliers/fornecedores conceptually, but uses the legacy transactions table, not the new `suppliers` table. Suggest renaming label to "Fornecedores" and/or sourcing from `suppliers` table for accuracy.

2. **Card "Total Aprovado"** — counts `farmers.status = 'Aprovado'`. Represents the number of farmers whose registration was validated/approved by a supervisor (vs Pendente/Removido). Important KPI of registration pipeline quality.

For the runtime error: likely `criticalStockCount` or one of the new impact KPIs returning undefined when data is empty/loading. I'll include a small fix proposal.

# Resposta + correcção pequena

## 1. Card "Empresas"
Conta empresas distintas presentes em `farmer_transactions.empresa` (legado). Conceptualmente são fornecedores, mas a fonte é a tabela antiga de transacções e **não** a tabela `suppliers` (que é a fonte oficial do MOSAP3Pay).

Recomendação:
- Renomear o rótulo para **"Fornecedores"**.
- Mudar a fonte para `SELECT count(*) FROM suppliers WHERE status='Ativo'` — reflecte os fornecedores realmente registados no sistema, incluindo os que ainda não fizeram vendas.

## 2. Card "Total Aprovado"
Conta produtores com `farmers.status = 'Aprovado'`. Representa quantos cadastros foram **validados pelo supervisor** (vs `Pendente` ou `Removido`). É o indicador de qualidade do funil de registo: quantos dos produtores cadastrados estão prontos a receber incentivos.

Sugestão de melhoria de leitura: mostrar como **"Aprovados / Total"** com badge de % (ex.: `847 / 1.203 — 70%`), para dar contexto imediato em vez de número isolado.

## 3. Correcção silenciosa
Detectei runtime error `n.toLocaleString` — provavelmente de um dos novos KPIs (`avgYieldPerHa`, `volumeTransactions`, `criticalStockCount`) a chegar `undefined` no primeiro render. Vou adicionar fallbacks `?? 0` nos cards de Impacto.

## Plano (1 ficheiro)
- `src/hooks/useDashboardData.ts`: trocar `totalCompanies` para contar `suppliers` activos.
- `src/pages/Dashboard.tsx`: renomear "Empresas" → "Fornecedores"; mudar "Total Aprovado" → mostrar `aprovados / total (X%)`; adicionar `?? 0` nos `.toLocaleString()` dos novos cards.

Sem migrações. Mudança baixa, ~1 passagem.
