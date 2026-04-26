## Diagnóstico

Ao navegar para `/escolas/provincia/benguela` o ErrorBoundary apanha o **Minified React error #310** ("Rendered more hooks than during the previous render"). A página fica em branco com a mensagem "Ocorreu um erro inesperado".

### Causa raiz

Em `src/pages/ProvinciaEscolas.tsx` o hook `useMemo` (linha 106, cálculo de `filteredSchools`) é chamado **depois** de dois `return` condicionais:

1. Linha 62-68: `if (loading) return <Loader2 />` 
2. Linha 72-81: `if (!province) return <...Província não encontrada />`

No primeiro render `loading=true` → React executa apenas `useParams`, `useProvincesData`, `useState x2` (4 hooks) e sai pelo early return.  
No segundo render `loading=false` e `province` existe → React tenta executar também o `useMemo` (5º hook). A contagem muda e o React rebenta. É exactamente o que acontece em Benguela porque a província existe e tem dados.

Isto viola a primeira [Rule of Hooks](https://react.dev/reference/rules/rules-of-hooks): hooks têm de ser chamados sempre na mesma ordem, no topo do componente, antes de qualquer `return` condicional.

## Correção

Reorganizar `ProvinciaEscolas.tsx` para que **todos os hooks sejam chamados antes dos early returns**:

1. Mover a procura de `province` (`provinces.find`) para um `useMemo` no topo (depende de `provinces` e `slug`).
2. Mover o cálculo de `provSchools`, `provMunicipalities`, `byMunicipality`, `sortedMunicipalities`, `municipalitiesWithout` para `useMemo`s no topo, todos a tratar o caso `province == null` devolvendo arrays/objectos vazios.
3. Manter o `useMemo` de `filteredSchools` igualmente no topo.
4. Só **depois** de todos os hooks declarados, fazer os early returns para `loading` e `!province`.

Isto garante contagem estável de hooks em todos os renders e elimina o crash.

### Verificação adicional

- Confirmar que `getMunicipalitiesByProvince` e `getSchoolsByProvince` (de `useProvincesData`) aceitam ser chamados com qualquer string sem erro — já aceitam, fazem só `filter`.
- Sem alterações de schema, RLS, hooks ou outras páginas.

## Ficheiros afectados

- `src/pages/ProvinciaEscolas.tsx` (única alteração)

## Resultado esperado

A página `/escolas/provincia/:slug` carrega normalmente em qualquer província (incluindo Benguela), sem disparar o ErrorBoundary.