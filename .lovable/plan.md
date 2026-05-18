## Problema

A secção "Composição dos Pacotes" da aba **Atribuição** mostra apenas 3 linhas (PATEC 1, 2, 3) porque está implementada com um array literal `[1, 2, 3]` e um mapa local `patecMeta` (legado, criado quando só existiam 3 pacotes). Já a aba **Pacotes** lê o catálogo real via `usePatecs()` e mostra os 10 PATECs registados na base de dados (`patecs` + `patec_items` por `patec_code`).

Há, portanto, duas fontes de verdade no mesmo ficheiro:

- Legado: `patec_items.patec_number` (1–3) + `patecMeta` + estado `viewPatec: number` + dialog inline (linhas ~1165–1230)
- Actual: tabela `patecs` (`usePatecs`) + `patec_items.patec_code` + `PatecCompositionDialog`

A lista compacta está ligada ao legado e ignora pacotes ≥ 4.

## Objectivo

Fazer a lista compacta da aba Atribuição refletir **todos** os pacotes do catálogo (mesma fonte que a aba Pacotes), mantendo o resto da aba intacto.

## Mudanças propostas (apenas UI, em `src/pages/Patec.tsx`)

1. **Origem dos dados da lista**: substituir `[1, 2, 3].filter(...)` por iteração sobre `patecs` (já disponível via `usePatecs()` na linha 129). Ordenar por `sort_order`/`code` e, por defeito, mostrar apenas `is_active = true` (com nota visual; pacotes inactivos ficam ocultos da lista compacta).

2. **Contagem de itens por pacote**: adicionar um pequeno agregado que conta `patec_items` agrupado por `patec_code` (uma query única `select patec_code, count(*) from patec_items group by patec_code`, ou usar `supabase.rpc`/uma agregação client-side). Guardar num `Record<string, number>` e mostrar no `Badge` existente.

3. **Visual de cada linha**: manter o layout actual (`<li>` com ícone redondo + nome + badge + botão Detalhes), mas:
   - Nome: `p.code` em negrito + `p.name` (ou `p.cultures`) em `text-muted-foreground` — vindo de `Patec`, não de `patecMeta`.
   - Ícone redondo: usar `patecMeta[p.legacy_number].gradient` quando existir `legacy_number` (mantém o gradiente actual dos PATECs 1–3); para os restantes, fallback para `bg-primary/10` com ícone `Package` (já é o padrão usado na aba Pacotes).
   - Badge: `${count} item(s)` proveniente do agregado real.

4. **Botão Detalhes**: passar a abrir o `PatecCompositionDialog` (importado de `@/components/patec/PatecCompositionDialog`) com o objecto `Patec` completo — mesmo dialog rico já usado na aba Pacotes (categorias, subcategorias, edição inline de quantidades). Isto remove a divergência funcional entre as duas abas.
   - Novo estado: `const [composing, setComposing] = useState<Patec | null>(null);` (paralelo ao `viewPatec` legado, que se mantém apenas para os outros pontos do ficheiro que ainda dependem dele — linhas 1165+).

5. **Pesquisa**: manter o input `compositionSearch` já existente; passar a filtrar por `p.code`, `p.name` e `p.cultures`.

6. **Fora do âmbito** (não mexer):
   - Restantes secções da aba Atribuição (cards de stats, gráfico, atribuição massiva, tabela de produtores) — continuam baseadas em `legacy_number` 1/2/3, que é como os agricultores estão actualmente vinculados.
   - O dialog inline antigo (`viewPatec` + `patec_items.patec_number`) e o mapa `patecMeta` — ficam, porque são usados noutros sítios do ficheiro.
   - Nenhuma alteração de schema, RLS, ou lógica de negócio.

## Detalhes técnicos

- Ficheiros tocados: apenas `src/pages/Patec.tsx`.
- Import adicional: `PatecCompositionDialog` de `@/components/patec/PatecCompositionDialog`.
- Query nova (no mesmo `useEffect` que faz `fetchPatecItems`, ou num pequeno hook local):
  ```ts
  const { data } = await supabase.from("patec_items").select("patec_code").not("patec_code", "is", null);
  const counts = (data ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.patec_code] = (acc[r.patec_code] ?? 0) + 1; return acc;
  }, {});
  ```
- Sem novos testes obrigatórios; os testes existentes (`patec-assignment-guard.test.ts`, `Patec.test.tsx`) continuam válidos porque não tocam nesta secção.

## Resultado esperado

A secção "Composição dos Pacotes" passa a listar os **10 PATECs** activos do catálogo (com pesquisa funcional sobre todos), e o botão "Detalhes" abre o dialog completo já usado na aba Pacotes — coerente entre as duas abas.
