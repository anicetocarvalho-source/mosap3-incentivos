# Corrigir layout dos cards na página Escolas de Campo

## Problema identificado

No grid de províncias da página `/escolas` (`src/pages/EscolasCampo.tsx`), o card de **Cuando Cubango** (e outros nomes longos) apresenta:

1. O badge **"135 ativas"** quebra em duas linhas (`135` em cima, `ativas` em baixo) — falta `whitespace-nowrap`.
2. Quando o título ocupa duas linhas, o badge compete por espaço com o título e empurra a barra de progresso e a linha de estatísticas para baixo, desalinhando este card em relação aos vizinhos da mesma linha.
3. Os cards vizinhos parecem "vazios em baixo" porque não têm altura uniforme.

## Alterações propostas

**Ficheiro único: `src/pages/EscolasCampo.tsx`** — bloco do card de província dentro do grid final.

1. **Badge "X ativas" / "Sem escolas"**: adicionar `whitespace-nowrap shrink-0` para nunca partir o texto.
2. **Header do card**: adicionar `gap-2` e envolver o bloco do título num wrapper `min-w-0 flex-1` para permitir quebra controlada sem comprimir o badge.
3. **Altura uniforme**: aplicar `h-full flex flex-col` no `<Card>` e propagar `h-full` no `<motion.div>` e `<Link>` para todos os cards da mesma linha terem a mesma altura.
4. **Footer (escolas + produtores)**: usar `mt-auto` para encostar o footer à base do card, e `gap-x-4 gap-y-1 flex-wrap` para tolerar números grandes em viewports apertados.

## Fora do âmbito

- Sem alterações ao cabeçalho da página, KPIs, filtros, mapa Leaflet, tokens globais (`index.css`, `tailwind.config.ts`), nem às páginas `ProvinciaEscolas.tsx` / `EscolaDetalhe.tsx`.

## Resultado esperado

- Badge sempre numa única linha (ex.: "135 ativas").
- Cards com altura uniforme dentro da mesma linha do grid.
- Footer (escolas/produtores) alinhado horizontalmente entre cards vizinhos.
- Títulos longos como "Cuando Cubango" continuam totalmente legíveis sem quebrar o layout dos cartões adjacentes.