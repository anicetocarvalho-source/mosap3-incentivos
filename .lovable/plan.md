
## Objectivo

Mostrar, nas páginas `/escolas/provincia/:slug` (Província) e `/escolas/:id` (ECA), um bloco de **Resumo Financeiro** consolidado com os totais dos agricultores dessa província/ECA:

- **Total Recebido** (soma de `farmers.valor_recebido`)
- **Total Gasto** (soma de `farmers.total_gasto`)
- **Saldo Final** (soma de `farmers.saldo_final`)
- **Nº de produtores com incentivo** (com `valor_recebido > 0`)
- **Taxa de Utilização** (`gasto / recebido * 100`)

Usa-se `parseAmount` / `formatKz` (PT-AO) já existentes em `src/lib/numberFormat.ts`, consistentes com `EcaBalanceTable` e `Agricultores`.

---

## 1. Novo hook `src/hooks/useFinancialSummary.ts`

Hook reutilizável que recebe um filtro (`{ province?: string }` ou `{ school?: string; province?: string }`) e devolve `{ recebido, gasto, saldo, beneficiarios, totalFarmers, utilizationPct, loading, error }`.

- Usa `fetchAllPages` (já existe) para contornar o limite de 1000 linhas.
- `SELECT code, valor_recebido, total_gasto, saldo_final FROM farmers` filtrado por `province` (e opcionalmente `school` via `.ilike`), excluindo `status = 'Removido'`.
- Agrega no cliente com `parseAmount` (suporta formato PT-AO `915.840,00`).
- `staleTime` razoável (2 min) — usar `useQuery` do React Query para coerência com `useReportData`.

## 2. `src/pages/ProvinciaEscolas.tsx`

- Chamar `useFinancialSummary({ province: province.name })` (depois dos restantes hooks, para respeitar Rules of Hooks já corrigidas).
- Adicionar um novo bloco **logo abaixo do grid de "Summary"** (linha 220) com título **"Resumo Financeiro da Província"** e 4 cartões:
  - Total Recebido (verde — `text-success`)
  - Total Gasto (âmbar — `text-warning`)
  - Saldo Final (cor condicional: verde se ≥0, vermelho se <0)
  - Beneficiários / Taxa de Utilização (`%`)
- Usar `formatKz()` para valores monetários e `formatKzCompact()` em ecrãs estreitos quando aplicável.
- Estado de loading: skeleton dentro dos cartões; estado de erro: mensagem discreta `text-destructive`.

## 3. `src/pages/EscolaDetalhe.tsx`

- Chamar `useFinancialSummary({ province: school.province, school: school.name })` após o early-return de `!school`.
- Adicionar novo `Card` **"Resumo Financeiro da ECA"** entre o "Summary Cards" (linha 342) e o "Phase Overview" (linha 344), com os mesmos 4 KPIs.
- Mesma formatação `formatKz` e tratamento de loading/erro.

## 4. Permissões / RLS

A tabela `farmers` já tem política `Backoffice can view farmers` (`has_any_backoffice_role(auth.uid())`) — qualquer utilizador autenticado de back-office vê os totais. Não são necessárias migrações.

Nota: o filtro é aplicado no cliente por `province`/`school` (texto livre nos farmers). Coerente com `EcaBalanceTable` e `dashboard_kpis` que usam exactamente o mesmo padrão.

## 5. Memória

Actualizar `mem://features/escolas-campo-dashboard` para incluir: "Páginas de Província e ECA mostram resumo financeiro (recebido, gasto, saldo, beneficiários, taxa de utilização) usando `useFinancialSummary` + `parseAmount`/`formatKz`".

## Ficheiros a criar/editar

- **Novo**: `src/hooks/useFinancialSummary.ts`
- `src/pages/ProvinciaEscolas.tsx` — adicionar bloco de KPIs financeiros
- `src/pages/EscolaDetalhe.tsx` — adicionar bloco de KPIs financeiros
- `mem://features/escolas-campo-dashboard` — actualização

Sem alterações de schema, sem migrações.
