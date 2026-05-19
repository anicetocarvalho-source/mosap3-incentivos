## Problema

A aba **Atribuição** de `/patec` foi escrita quando só existiam 3 pacotes. Hoje há **10 PATECs activos** (PATEC-01 … PATEC-10), mas a página continua a tratar apenas os 3 primeiros nos KPIs, na validação de equilíbrio, no gráfico e no filtro. Resultado: produtores atribuídos a PATEC-04…PATEC-10 não aparecem em lado nenhum como "atribuídos" e contam erradamente como "Sem PATEC".

Pontos concretos identificados em `src/pages/Patec.tsx`:

- `patecMeta` (linhas 64–68) só cobre 1, 2, 3 → restantes pacotes caem em fallback genérico (ícone Package, sem cor).
- `stats` (linhas 510–516) conta `patec1/2/3` por `f.patec === N` e `semPatec` por `!f.patec` — ignora `patec_code` dos PATEC-04…10, inflando "Sem PATEC".
- Grelha de cards "Stats" (linhas 840–882) fixa em 5 cartões (Total + 1/2/3 + Sem).
- Bloco "Validação de distribuição (terços)" (linhas 884–943) assume ideal 33,3% — inválido com 10 pacotes.
- Gráfico (linhas 945–982) com 4 barras fixas.
- Filtro `Select` (linhas 1168–1180) só lista 1, 2, 3 e usa `String(f.patec) === filterPatec` que não combina com `patec_code`.

Pacotes (`Pacotes`/`Épocas`) e composição já são dinâmicos via `usePatecs()` — não mexem.

## Mudanças (somente apresentação, em `src/pages/Patec.tsx`)

### 1. Stats dinâmicos por pacote

Substituir o objecto `stats` por um cálculo derivado de `patecs`:

```text
countsByCode   = { [p.code]: nº de farmers cujo patec_code === p.code
                                OU (patec_code nulo e patec === p.legacy_number) }
semPatec       = farmers sem patec_code E sem patec
total          = farmersByProvince.length
assignedTotal  = soma de countsByCode
```

Reutilizar `findPatecByFarmer` para classificar cada produtor uma única vez (memoizado).

### 2. Grelha de cards adaptativa

Renderizar 1 cartão por pacote em `patecs` (ordenado por `sort_order`), mais Total e Sem PATEC. Layout responsivo:

```text
grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6
```

- Cor/ícone: usar `patecMeta[p.legacy_number]` quando existir; caso contrário usar gradiente derivado de `p.color_token`/fallback neutro e ícone `Package`.
- Cada card continua clicável para `setFilterPatec(p.code)`.

### 3. Validação de equilíbrio generalizada

- Ideal por pacote = `100 / patecs.length` % (ex.: 10% com 10 pacotes).
- Tolerância: ≤ 2pp considerado equilibrado.
- Substituir as 3 badges fixas por uma lista compacta de badges (uma por pacote) com contagem e percentagem.
- Texto: "Ideal: X,X% por pacote · desvio máximo Y,Y%".

### 4. Gráfico dinâmico

Substituir o array hardcoded por:

```text
data = patecs.map(p => ({ name: p.code, value: countsByCode[p.code] || 0,
                          fill: corDoPacote(p) }))
       .concat([{ name: "Sem PATEC", value: semPatec, fill: destructive }])
```

Manter `RechartsBarChart` com `XAxis` rotacionado ou abreviado se houver overflow (`interval={0}`, `angle={-25}`, `textAnchor="end"`, `height={50}`).

### 5. Filtro PATEC dinâmico

Trocar opções fixas por:

- "Todos os Produtores"
- Uma `SelectItem` por `p` em `patecs` activos, com `value=p.code` e label `${p.code} — ${p.cultures || p.name}`
- "Sem PATEC"

Actualizar a lógica de `filtered` para:

```text
matchesPatec =
  filterPatec === "all" ||
  (filterPatec === "none" && !f.patec && !f.patec_code) ||
  f.patec_code === filterPatec ||
  (legacy_number do filtro === f.patec)
```

### 6. Pequenas correcções de consistência

- `semPatec` em todo o ficheiro passa a usar `!f.patec && !f.patec_code` (já é o critério usado em `semPatecPool`).
- Initial param `?patec=` agora aceita `code` (PATEC-04…) além de "1/2/3/none" — manter retro-compatibilidade no parser.

## Fora de âmbito

- Abas **Pacotes** e **Épocas Agrícolas** (já dinâmicas).
- Composição/realtime/reconciliação de `itemCountsByCode` (intactas).
- Backend, RLS, migrações — nenhuma alteração necessária.

## Verificação

- `bunx tsc --noEmit`.
- Conferir visualmente em `/patec` (10 cards + Total + Sem PATEC), validação 10%, gráfico com 11 barras, filtro com 10 opções + "Sem PATEC".
