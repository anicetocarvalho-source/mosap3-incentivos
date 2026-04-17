
User wants the 2 issues fixed: breadcrumb capitalization ("Escolas De Campo") and `/auth` redirect when already authenticated.

Plan:

# Corrigir 2 Pontos do Relatório de Testes

## 1. Capitalização do breadcrumb
Em `src/components/AppTopbar.tsx`, o `labelFor()` faz `replace(/-/g, " ")` mas o CSS aplica `capitalize` que capitaliza cada palavra ("De" em vez de "de"). 

**Fix**: substituir `capitalize` por capitalização manual só da primeira letra, OU adicionar mapeamentos completos no `ROUTE_LABELS` para segmentos compostos. Vou usar a abordagem mais limpa: remover `capitalize` e capitalizar apenas a primeira letra no helper, mantendo as labels do mapa exactas (ex: "Escolas de Campo").

## 2. Redirect de `/auth` quando autenticado
Em `src/pages/Auth.tsx`, adicionar `useEffect` que verifica `useAuth()` — se `user` existe e `authReady`, faz `navigate("/", { replace: true })`.

## Ficheiros
| Ficheiro | Alteração |
|---|---|
| `src/components/AppTopbar.tsx` | Remover `capitalize`, capitalizar só 1ª letra; adicionar label "Escolas de Campo" |
| `src/pages/Auth.tsx` | `useEffect` redirect para `/` quando já autenticado |
