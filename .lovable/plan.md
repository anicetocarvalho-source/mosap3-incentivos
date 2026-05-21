# Corrigir sobreposição do mapa sobre o diálogo "Nova Parcela"

## Diagnóstico

O `ParcelasMap` (Leaflet vanilla) renderiza painéis, marcadores e controlos com `z-index` internos altos (400–700). O diálogo "Registar Parcela" (Radix Dialog) usa `z-50` no overlay e conteúdo. Como o contentor do mapa não cria um *stacking context* próprio, os elementos internos do Leaflet "furam" o overlay do diálogo e aparecem por cima do formulário.

## Correção

Forçar o mapa a viver dentro do seu próprio *stacking context*, abaixo do diálogo:

- Em `src/components/ParcelasMap.tsx`, no `<div>` wrapper (linha 109), juntar as classes `relative z-0 isolate` ao `className` existente.

Isto isola tudo o que o Leaflet pinta (tiles, marcadores, popups, controlos de zoom) dentro de um contexto cujo z-index máximo é 0, ficando garantidamente atrás do portal do Dialog (`z-50`).

## Detalhes técnicos

- Ficheiro único a editar: `src/components/ParcelasMap.tsx` — alteração de uma só linha (`className` do wrapper).
- Não mexe em CSS global, nem no `Dialog`, nem no `z-index` do Leaflet.
- Mesmo padrão deve ser memorizado para outros mapas Leaflet do projeto (futura prevenção).

## QA visual

- Abrir `/parcelas`, clicar "Nova Parcela" e confirmar que o overlay escurece todo o mapa e que nenhum marcador/controle aparece sobre o diálogo.
- Fechar e reabrir para confirmar que o mapa volta normalmente.
