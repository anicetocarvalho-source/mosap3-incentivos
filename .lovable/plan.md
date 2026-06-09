## Problema

Na lista de Pacotes em `/patec`, PATEC-14 (Ovinos) e PATEC-15 (Suínos) mostram "0 itens" e o diálogo "Composição" abre vazio.

Causa: `fetchPatecItems` em `src/pages/Patec.tsx` faz `supabase.from("patec_items").select("*").order("created_at")` sem paginação. A tabela tem **1195 linhas** mas o PostgREST devolve no máximo **1000** por pedido. Os últimos códigos por `created_at` (PATEC-14 e PATEC-15) ficam truncados, daí a contagem 0.

Confirmação na BD: `patec_items` tem 81 linhas em PATEC-14 e 73 em PATEC-15 — os dados estão corretos, só o fetch é que corta.

## Correção

Em `src/pages/Patec.tsx`, alterar `fetchPatecItems` para iterar com `.range(from, to)` em blocos de 1000 até esgotar:

```ts
const pageSize = 1000;
let from = 0;
const all: any[] = [];
while (true) {
  const { data, error } = await supabase
    .from("patec_items")
    .select("*")
    .order("created_at")
    .range(from, from + pageSize - 1);
  if (error) throw error;
  const batch = data || [];
  all.push(...batch);
  if (batch.length < pageSize) break;
  from += pageSize;
}
```

Depois reaproveitar a lógica existente para popular `patecItems` e `itemCountsByCode`.

## Fora de escopo

- Nenhuma alteração de BD, schema, RLS, ou ao diálogo de composição.
- Sem mexer em `patec_package_*`, baselines, ou regras de pecuária/irrigação.
