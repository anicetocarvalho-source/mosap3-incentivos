## Causa

A tabela `patec_items` tem **1195 linhas**. Ordenadas por `created_at`, os itens dos pacotes **PATEC-14 (Ovinos, 81)** e **PATEC-15 (Suínos, 73)** ficam todos depois do offset 1000 — ou seja, **só aparecem na 2ª página da paginação**.

O loop em `src/pages/Patec.tsx → fetchPatecItems` (linhas 285-296) só busca a página seguinte se a anterior retornar **exactamente** `pageSize` (1000). Em ambiente real essa segunda página não está a ser materializada (`batch.length < pageSize` dispara antes do esperado, provavelmente por limite `db.max_rows` do PostgREST ou timeout intermitente), pelo que `itemCountsByCode["PATEC-14"]` e `["PATEC-15"]` ficam em **0** e a badge da lista lateral mostra "0 itens".

Confirmado em BD: PATEC-14 = 81 itens (2 animal, 12 ração, 34 veterinária, 33 equipamento) e PATEC-15 = 73 itens, todos com `category='pecuaria'`. Logo o problema é apenas de leitura no frontend.

## Correcção (apenas frontend, `src/pages/Patec.tsx`)

**1. Substituir o cálculo das contagens por uma chamada robusta e independente da paginação.**

Em vez de derivar `itemCountsByCode` da lista completa de `patec_items`, calcular as contagens em paralelo por pacote usando `head:true` (que devolve apenas o `count`, ignorando `db.max_rows`):

```ts
const counts: Record<string, number> = {};
await Promise.all(
  patecs.map(async (p) => {
    const { count } = await supabase
      .from("patec_items")
      .select("id", { count: "exact", head: true })
      .eq("patec_code", p.code);
    counts[p.code] = count ?? 0;
  })
);
setItemCountsByCode(counts);
```

Isto é exactamente a mesma técnica já usada em `reconcileDirtyCodes` (linhas 348-353), logo é coerente com o resto do ficheiro.

**2. Tornar a paginação de `patecItems` resistente ao limite real do servidor.**

Pedir o `count: 'exact'` na 1ª página e continuar até `all.length >= totalCount` (em vez de `batch.length < pageSize`), com um tecto de segurança para evitar loop infinito:

```ts
const { data, error, count } = await supabase
  .from("patec_items")
  .select("*", { count: "exact" })
  .order("created_at")
  .range(0, pageSize - 1);
// ...loop enquanto all.length < (count ?? 0) e batch.length > 0
```

Se mesmo assim faltarem itens (ex.: erro intermitente numa página), registar `console.warn` mas **não bloquear** — a UI agora usa `itemCountsByCode` calculado por (1), que já está correcto.

**3. Dependência da `useEffect` de boot (linha 321)**

Garantir que `fetchPatecItems` só corre depois de `patecs` estar carregado (já há `patecsLoading`), uma vez que o passo (1) precisa de iterar sobre `patecs`. Resolver com um `useEffect` que dispara quando `patecs.length > 0`.

## Fora de âmbito

- Não tocar em `patec_items` na BD — os dados estão correctos.
- Não alterar `PatecCompositionDialog` (já lê via `eq("patec_code", patec.code)` e funciona).
- Não mexer em POS, relatórios, ECA nem cartões.
- Sem migrações.

## Validação manual

1. Abrir `/patec` como admin.
2. Na lista lateral "Composição dos Pacotes":
   - PATEC-11 → 73 itens
   - PATEC-12 → 82 itens
   - PATEC-13 → 80 itens
   - PATEC-14 (Ovinos) → **81 itens** ✅
   - PATEC-15 (Suínos) → **73 itens** ✅
3. Clicar "Detalhes" em PATEC-14 → tab Pecuária mostra 81 itens agrupados (Efectivo Animal 2, Ração 12, Veterinária 34, Equipamentos 33).
