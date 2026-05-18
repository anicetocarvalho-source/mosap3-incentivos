# Compactar secção "Composição dos Pacotes" — aba Atribuição (/patec)

## Objetivo
Reduzir o espaço vertical ocupado pelos 3 cartões detalhados de composição, mantendo o acesso rápido aos detalhes via diálogo já existente.

## Mudança
Em `src/pages/Patec.tsx` (linhas 751–784), substituir o grid de 3 `Card` por uma lista compacta de 1 linha por PATEC.

### Novo formato (1 linha por PATEC)
Cada linha contém:
- Ícone redondo pequeno com gradiente da cor do pacote (mantém `patecMeta[p].gradient`)
- `PATEC N` em negrito + nome curto das culturas (`meta.cultures + " + Gado"`) em `text-muted-foreground`
- Badge com contagem total de itens (insumos + pecuária + serviços) — derivada da mesma fonte usada por `renderItemList`
- Botão `Detalhes` (`Eye`) à direita que abre o diálogo `PatecCompositionDialog` (já em uso via `setViewPatec`)

Layout: um único `Card` envolvente com `divide-y`, cada linha `flex items-center gap-3 px-4 py-2.5`. Mantém o cabeçalho `Composição dos Pacotes` com o ícone `TreeDeciduous`.

### Remover
- Grid `md:grid-cols-3` com os 3 cartões altos
- Chamada `renderItemList` triplicada por cartão (responsável pela maior parte da altura)

### Manter
- Função `renderItemList` continua usada pelo `PatecCompositionDialog` / outras vistas — não remover
- Estado `viewPatec` e o dialog inalterados

## Detalhes técnicos
- Apenas edição de JSX em `src/pages/Patec.tsx` (~30 linhas substituídas por ~20)
- Sem alterações de dados, hooks, queries ou tipos
- Sem impacto em testes existentes (`patec-assignment-guard.test.ts`, `Patec.test.tsx`)
- Tokens semânticos preservados (`text-primary`, `text-muted-foreground`, gradientes via `patecMeta`)
- Responsivo: a lista vertical funciona naturalmente em mobile e desktop

## Resultado esperado
A secção passa de ~3 cartões com listas internas (ocupando tipicamente 400–600px de altura) para ~3 linhas compactas (~150px), encurtando significativamente a página da aba Atribuição.
