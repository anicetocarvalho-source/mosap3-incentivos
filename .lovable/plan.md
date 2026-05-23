## Problema

Em `/producao`, ao abrir "Nova Produção", o selector "Produtor" aparece vazio (ou sem os produtores esperados).

A query actual em `src/pages/Producao.tsx` (linhas 60-67) faz:
```ts
supabase.from("farmers").select("code, full_name").neq("status","Removido").order("full_name")
```
não aplica o âmbito geográfico do utilizador (províncias / ECAs) — ao contrário de `useFarmersList` que usa `applyFarmerScopeFilter`. Para perfis como sénior, júnior ou extensionista, isso pode resultar em lista vazia ou inconsistente com o resto da plataforma. Além disso, a query também não está a tratar nenhum filtro de scope, e a pesquisa dentro do `Select` é inexistente quando há muitos produtores.

## Correcção

**Ficheiro:** `src/pages/Producao.tsx`

1. Substituir a query local `farmers_list_select` pela utilização do hook `useFarmersList()`, que já:
   - aplica `resolveScope` + `applyFarmerScopeFilter` (províncias/ECAs do utilizador)
   - exclui automaticamente `status = 'Removido'`
   - usa `fetchAllPages` corretamente
   - é consistente com `/agricultores`, dashboard e restantes módulos.

2. Ordenar por `full_name` no lado do cliente após carregar.

3. Tornar o `Select` pesquisável: substituir o `Select` simples pelo padrão `Popover + Command` (já usado noutras páginas como `/incentivos` / `BatchDistributionDialog`) para permitir pesquisa por nome ou código — útil quando o utilizador tem centenas de produtores no seu âmbito.

4. Mostrar `code · full_name` no item para evitar ambiguidade entre homónimos.

5. Mostrar mensagem "Sem produtores no seu âmbito" quando a lista estiver vazia, para que o utilizador perceba que não é um bug silencioso.

Sem alterações a backend, RLS ou outras páginas.

## Verificação

- Abrir `/producao` → "Nova Produção" → o selector deve listar os mesmos produtores que aparecem em `/agricultores` para o utilizador autenticado.
- Testar com perfil admin (lista global) e com perfil sénior/extensionista (lista filtrada pela província/ECA).
- Pesquisar pelo nome no campo e confirmar filtragem instantânea.
