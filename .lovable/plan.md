# Auditoria de ECAs (Escolas de Campo)

## Contexto

A correcção feita em `useSchoolDetail` resolveu o caso "1 De Maio" (Balombo). Mas a base de dados tem:

- **38 nomes de escolas duplicados** distribuídos por **89 registos** (ex.: `Boa Esperanca` aparece 5×, `4 De Abril` e `Boa Vida` 4×, `1 De Maio`, `4 De Fevereiro`, `Elavoko`, `Rei Mandume`, `Tuapandula`, `Tuayovoka` 3× cada).
- **Nomes muito parecidos** que provavelmente são a mesma escola escrita de forma diferente (ex.: `Elavoko` vs `Elavoco`, `Tuapandula` vs `Twapandula`, `Tuayovoka` vs `Twayovoka`, `Uniao Faz A Forca` vs `A Uniao Faz A Forca`, `Santo  Antonio` com espaço duplo, `Kuatoko` vs `Kuatoko Namukueno`).

O botão `Validar contagens` na página `/escolas` já cobre o **caso 1** (duplicados exactos). Falta cobrir os **casos restantes** e tornar a auditoria navegável.

## O que vou construir

### 1. Página dedicada `/escolas/auditoria`

Acessível via novo botão **"Auditoria"** no cabeçalho de `/escolas` (ao lado de "Validar contagens"). Apenas para Admin / Gestor de Incentivos.

Estrutura em **3 separadores**:

#### Tab A — Duplicados exactos (mesmo nome)
Lista as 89 escolas com nome repetido, agrupadas por nome:

| Nome | Província | Município | Real | Cache | Δ | Estado | Ações |
|---|---|---|---:|---:|---:|---|---|
| 1 De Maio | Benguela | Balombo | 20 | 76 | −56 | ⚠️ | Abrir ECA |

- "Real" = produtores filtrados por `school + province + município` (mesma lógica de `useSchoolDetail`).
- "Cache" = `schools.total_farmers`.
- Linha vermelha quando `Real ≠ Cache`.
- Resumo no topo: total de ECAs auditadas, total com discrepância, somatório de produtores "perdidos/sobrantes".

#### Tab B — Nomes similares (potenciais duplicados ortográficos)
Compara todos os nomes de escolas par a par (após normalização: minúsculas, sem acentos, espaços colapsados) e mostra pares com:
- distância de Levenshtein ≤ 2, **ou**
- um nome contido no outro (ex.: `Kuatoko` ⊂ `Kuatoko Namukueno`), **ou**
- igualdade após colapsar espaços/acentos (apanha o caso `Santo  Antonio`).

Tabela:

| Nome A (Município/Província) | Nome B (Município/Província) | Distância | Nº produtores A | Nº produtores B | Ação |
|---|---|---:|---:|---:|---|
| Elavoko (Cuvango/Huíla) | Elavoco (Cuvango/Huíla) | 1 | 12 | 8 | Abrir ambas |

Útil para o utilizador decidir se são a mesma ECA mal escrita.

#### Tab C — Produtores "órfãos" por escola
Para cada ECA, conta produtores cujo `farmers.school` bate com o nome mas o `province` ou `municipality` não bate com nenhuma das ECAs com esse nome — ou seja, produtores que nunca aparecem em nenhum detalhe de ECA. Mostra apenas linhas com órfãos > 0.

### 2. Exportação
Botão **"Exportar CSV"** em cada tab para enviar ao Gestor de Incentivos.

### 3. Não vou (fora de âmbito)
- **Não** vou fundir/renomear escolas automaticamente — só sinalizar.
- **Não** vou actualizar a coluna `schools.total_farmers` (continua a ser o cache informativo das listagens). Se quiser, faço num passo seguinte um botão "Recalcular caches" que corre uma query `UPDATE schools SET total_farmers = ...`.
- **Não** vou introduzir `school_id` em `farmers` (mudança estrutural maior).

## Detalhes técnicos

- Nova rota `src/pages/EscolasAuditoria.tsx` registada em `src/App.tsx` dentro do `ProtectedRoute` + `RoleGuard` (`admin`, `gestor_incentivos`).
- Novo hook `src/hooks/useEscolasAuditoria.ts` que carrega numa só passagem: `schools` + `provinces` + `municipalities` + `farmers` (apenas colunas necessárias, paginação via `fetchAllPages`) e devolve já as 3 estruturas de dados das tabs.
- Função utilitária `src/lib/stringSimilarity.ts` com `normalize()` (lowercase + `normalize("NFD")` + remoção de diacríticos + colapso de espaços) e `levenshtein(a,b)` (implementação O(n·m) em ~30 linhas, suficiente para ~máx. 500 escolas → 125k pares ainda no cliente).
- Botão "Auditoria" adicionado em `src/pages/EscolasCampo.tsx` ao lado de `ValidateSchoolCountsButton`.
- Reutiliza componentes shadcn (`Tabs`, `Table`, `Badge`, `Button`).

## Ficheiros a alterar / criar

- criar `src/pages/EscolasAuditoria.tsx`
- criar `src/hooks/useEscolasAuditoria.ts`
- criar `src/lib/stringSimilarity.ts`
- editar `src/App.tsx` (rota nova)
- editar `src/pages/EscolasCampo.tsx` (botão "Auditoria")

Confirma e implemento.
