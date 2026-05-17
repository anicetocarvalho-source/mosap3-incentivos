## Contexto

A página `/patec` já tem três separadores:

- **Épocas Agrícolas** — CRUD de épocas (tabela `agricultural_seasons`).
- **Pacotes** — lista os 10 PATECs e permite ligar a cada PATEC uma ou mais épocas (tabela `patec_seasons`).
- **Atribuição** — onde se atribui o PATEC ao produtor.

O problema: o separador **Atribuição** está congelado nos PATECs antigos (1/2/3) e grava na coluna legacy `farmers.patec` (inteiro). Ignora os 10 PATECs novos, ignora a coluna `farmers.patec_code` (texto) e ignora as épocas. Por isso o fluxo "criar época → vincular ao pacote → atribuir ao agricultor" hoje não fecha.

## O que vai ser feito

### 1. Atribuição dinâmica baseada em `patecs` + `patec_seasons`

- O separador **Atribuição** passa a listar todos os PATECs activos vindos de `usePatecs({ activeOnly: true })`, ordenados por `sort_order`.
- Filtro "Filtrar PATEC", cards de stats, gráfico de distribuição e cartões de composição deixam de ter PATEC 1/2/3 hard-coded e passam a iterar sobre a lista dinâmica.
- Cada PATEC mostra um badge com a(s) época(s) vinculadas (a partir de `links` do `useSeasons`), e um aviso visual quando não tem nenhuma época associada.

### 2. Filtro por época agrícola

- Novo selector "Época" no topo do separador Atribuição. Por defeito assume a época **em curso** (`is_active = true` e `today` entre `start_date` e `end_date`); se não houver, mostra todas.
- Quando uma época é seleccionada, só ficam disponíveis para atribuição os PATECs vinculados a essa época (via `patec_seasons`). Os restantes aparecem desactivados com tooltip "Não vinculado à época X".

### 3. Gravação no `patec_code` (e compatibilidade)

- Atribuição individual e em lote passam a gravar `farmers.patec_code` (texto, ex.: `PATEC-04`).
- Por compatibilidade com o resto da app que ainda lê `farmers.patec`, quando o PATEC seleccionado tiver `legacy_number` preenchido também actualiza a coluna legacy; caso contrário fica `NULL`.
- A leitura na lista de produtores prefere `patec_code` e cai para `patec` legacy quando o código não está preenchido.

### 4. Stats, gráfico e reatribuição aleatória

- `stats` deixa de ter campos fixos `patec1/2/3` e passa a `Record<patec_code, number>` calculado dinamicamente.
- O gráfico de barras e a validação "distribuição em terços" passam a usar a lista dinâmica (a regra de equilíbrio passa a ser `100 / nº de PATECs activos`, com desvio máximo configurável).
- A acção "Reatribuir aleatoriamente" passa a distribuir os produtores sem PATEC pelos códigos dos PATECs activos da época seleccionada (em vez de só 1/2/3).

### 5. Atalhos de navegação entre separadores

- No separador **Épocas Agrícolas**, num cartão sem pacotes vinculados, botão "Vincular pacotes" abre directamente o `SeasonFormDialog` no modo edição.
- No separador **Pacotes**, num cartão sem épocas, botão "Vincular época" abre o diálogo de edição do PATEC já no campo de épocas.
- Depois de gravar uma época nova, toast com CTA "Atribuir agora" que muda para o separador **Atribuição** com o filtro de época pré-preenchido.

## Notas técnicas

- Ficheiros principais a tocar: `src/pages/Patec.tsx`, `src/components/patec/PatecsTab.tsx`, `src/components/patec/SeasonsTab.tsx`. Hooks `usePatecs` e `useSeasons` já chegam.
- Sem alterações de schema: `farmers.patec_code`, `patecs`, `patec_seasons` e `agricultural_seasons` já existem com as RLS adequadas.
- O `patecMeta` hardcoded (cores/ícones/gradientes para PATEC 1/2/3) é substituído por um resolver que usa `patec.icon` + `patec.color_token` da tabela `patecs`, com fallback neutro.
- Os contadores existentes em `farmerCountsByCode` já mapeiam legacy → code via `legacy_number`; passam a ser a fonte única para os stats.
- Sem mudanças em POS, incentivos ou outros módulos — apenas o UI de atribuição em `/patec`.
