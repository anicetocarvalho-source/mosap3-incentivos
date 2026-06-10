## Causa do problema

O diálogo "Composição" (`PatecCompositionDialog`) mostra apenas dois separadores: **Agricultura** e **Pecuária**, agrupando linhas pelo campo `patec_items.category`.

Na BD os 33 itens de Equipamento e os 20 itens de Sistema de Rega dos PATEC-01..10 estão gravados com:
- `category = 'equipamento'` (não `'agricultura'`)
- `category = 'irrigacao'` (não `'agricultura'`)

Resultado: caem fora dos dois separadores e não aparecem em lado nenhum — mesmo estando na base de dados.

## Correções

### 1. Migração de dados (`patec_items`)
- Re-categorizar para o campo `category` consistente:
  - `PATEC-01..10` → linhas com `category in ('equipamento','irrigacao')` passam a `category = 'agricultura'` (mantendo `subcategory = 'equipamento'` ou `'sistema_rega'`).
  - `PATEC-11..15` → mesmas regras para `category = 'pecuaria'` (caso existam).
- Aplicar quantidades padrão a itens com `base_quantity = 0`:
  - Ferramentas singulares (Enxada, Catana, Pá, Sacho, Machado, Lima, Martelo, Maceta, Ancinho, Fita métrica, Pulverizador): `1 un`.
  - EPI / consumíveis (Luvas, Máscara, Capas de chuva, Bota): `2 un`.
  - Construção/cercas (Adobe, Blocos de cimento, Chapa de zinco, Paus/Postes, Pregos, Rede galinheira, Dobradiça, Cordel, Correntes, Cadeado): `1 un` placeholder (a refinar pelos técnicos).
  - Pecuária leve (Bebedouro, Comedouro, Caixa plástica, Pipas, Balança normal/relógio): `1 un`.
  - Irrigação a 0 (Fita gotejadora 16 mm, Tubo gotejador 16 mm): `1 rolo`.
  - Itens "Fita de rega" / "Mangueira de rega" de `equipamento` (duplicados com sistema_rega): `1 un`.
- Replicação idêntica para PATEC-02..10 (mesma cultura por pacote, mesmos consumíveis base).

### 2. Diálogo de Composição (`src/components/patec/PatecCompositionDialog.tsx`)
- Adicionar rótulo amigável: `sistema_rega: "Irrigação"`, `corretivo: "Correctivos do Solo"`, `fitossanitario: "Fitossanitários"`, `embalagem: "Embalagens"`.
- Renomear `equipamento: "Equipamentos e Ferramentas"`.
- Acrescentar `sistema_rega`, `corretivo`, `fitossanitario`, `embalagem` à lista `AGRICULTURA_SUBS` (para ficarem disponíveis no formulário "Adicionar item" e ordem coerente).
- Tornar a leitura **defensiva**: se aparecer `category` desconhecido, tratar como `agricultura` (fallback) — evita futura regressão semelhante.

### 3. Vista materializada
- Após o UPDATE, `REFRESH MATERIALIZED VIEW patec_package_expanded` para o POS/relatórios reflectirem a nova categoria.

## Fora do âmbito
- Não alterar o modelo normalizado (`patec_components` / `patec_package_components`) — continua válido; a divergência está só na tabela flat `patec_items`.
- Não mexer no POS, cartão ID nem relatórios (já lêem da view ou de `patec_items` sem filtrar por `category`).

## Faseamento
1. Migração SQL (UPDATE de category + UPDATE de quantidades + REFRESH da view).
2. Edição mínima do `PatecCompositionDialog` (rótulos + fallback de categoria).
3. Validar manualmente abrindo Composição de PATEC-01 e PATEC-05.
