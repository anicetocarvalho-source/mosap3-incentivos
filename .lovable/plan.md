## Problema

Em `src/pages/GestaoProvincias.tsx` os totais de **Produtores** (cards de resumo, cards por província e diálogo de detalhe) são calculados a partir de `schools.total_farmers`, que é um valor em cache desactualizado.

Exemplo real (BD):
- `SUM(schools.total_farmers)` = **16 211**
- `COUNT(*) FROM farmers` (canónico, com Removidos) = **14 819**

→ A página mostra **16 211 produtores**, enquanto Dashboard, Lista de Agricultores e Relatórios mostram **14 819**. Acresce que algumas escolas com nome duplicado em municípios diferentes têm o mesmo `total_farmers` somado em duplicado (já detectado pelo `ValidateSchoolCountsButton`).

Os totais de **Províncias** (5), **Municípios** (8) e **Escolas** (817) já vêm das tabelas correctas e estão alinhados — não precisam de mudança.

## Objectivo

Que os contadores de Produtores em `/provincias` (cards de topo, cards por província, badges no diálogo) correspondam exactamente ao que /dashboard, /agricultores e /escolas mostram. Regra do projecto (memória): Removidos contam em todos os agregados, portanto **não** aplicar `.neq('status','Removido')`.

## Mudanças

**Ficheiro único:** `src/pages/GestaoProvincias.tsx` (apenas UI / leitura, sem alterar BD nem hooks partilhados).

1. Adicionar fetch agregado dos produtores reais, agrupado por `province` e por `school` (normalizado: trim + lowercase), uma única vez ao carregar a página. Usar `fetchAllPages` para ultrapassar o limite de 1000 linhas, seleccionando apenas `province, municipality, school`.
2. Construir dois `Map`:
   - `realByProvince: Map<provinceNameNorm, number>`
   - `realBySchool: Map<"prov|mun|school", number>` (chave usa nome da província e do município resolvidos por id, igual à lógica do `ValidateSchoolCountsButton`).
3. Substituir todos os usos de `s.total_farmers` por `realBySchool.get(...) ?? 0` e todos os usos de `reduce(... + total_farmers)` por `realByProvince.get(provName) ?? 0`.
4. KPI global "Produtores" = soma de `realByProvince` (= total de farmers).
5. Exports CSV e PDF passam a usar os mesmos valores.
6. Adicionar estado de loading enquanto o agregado de farmers não chega (reutilizar o spinner já existente).

Sem alterações em hooks, BD, ou outras páginas. Sem alteração visual além dos números corrigidos.

## Validação

- Total do card "Produtores" deve ser **14 819** (= Dashboard).
- Soma dos cards por província deve ser **14 819** (Benguela 6 630, Huíla 2 934, Cunene 2 407, Cuando-Cubango 2 280, Namibe 568).
- `bunx tsc --noEmit` continua a passar.
