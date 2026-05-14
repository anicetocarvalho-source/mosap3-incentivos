## Objetivo
Reforçar a página `/transacoes` com filtros adicionais (produto, produtor, faixa de valor) e cards analíticos que reflectem os filtros activos (Total vendido, Top produtos, Top empresas — sempre com Kz e nº de transacções lado a lado).

## Mudanças

### 1. Base de dados (1 migração)
- Adicionar coluna **gerada** `valor_num numeric GENERATED ALWAYS AS (parse_ptao_numeric(valor)) STORED` em `farmer_transactions`. Permite `.gte/.lte` e ordenar por valor de forma indexada (hoje `valor` é texto PT-AO).
- Índices: `idx_ftx_valor_num` (btree em `valor_num`), `idx_ftx_farmer_name_trgm` em `farmers.full_name` (já existe via `pg_trgm`, confirmar).
- RPC `transacoes_kpis(p_search text, p_empresa text, p_product text, p_farmer text, p_min numeric, p_max numeric)` retorna JSONB:
  - `total_count`, `total_volume_kz`
  - `min_valor`, `max_valor`, `avg_valor`
  - `top_products`: array com 5 itens `{ product, total_kz, count }` (ordem por total_kz desc)
  - `top_empresas`: array com 5 itens `{ empresa, total_kz, count }` (ordem por total_kz desc)
  - `top_products_by_count`: array com 5 itens (ordem por nº de vendas desc)
  - `top_empresas_by_count`: idem
  - Aplica os mesmos filtros que a tabela. `SECURITY DEFINER`, `STABLE`, restrito a `authenticated`.

### 2. Hook `useServerTable`
Estender com `rangeFilters?: Array<{ column: string; gte?: number; lte?: number }>` (opcional). Sem mudança nas chamadas existentes.

### 3. Página `/transacoes`
- **Cards de KPI no topo (4 cards, reactivos aos filtros):**
  1. Total vendido (Kz) + nº de transacções
  2. Ticket médio / mín / máx
  3. Top 5 Produtos (lista compacta com Kz e nº de vendas lado a lado)
  4. Top 5 Empresas (Kz e nº lado a lado)
- **Barra de filtros expandida:**
  - Pesquisa livre (mantém)
  - Empresa (mantém)
  - **Produto** (Select com lista distinta — combobox pesquisável dado os 174 produtos)
  - **Produtor** (input livre, pesquisa por código/nome do agricultor — debounced)
  - **Faixa de valor**: dois inputs numéricos (Mín/Máx Kz)
  - **Ordenação**: Mais recentes (default) / Mais caros / Mais baratos / Maior volume primeiro
  - Botão "Limpar filtros"
- Tabela mantém estrutura, mas a coluna **Valor** passa a ordenar por `valor_num` quando o utilizador escolhe "mais caros/mais baratos".

### 4. Testes (Vitest)
- `transacoes-kpis.test.ts`: valida que soma das `top_products[].total_kz` ≤ `total_volume_kz`, soma de `count` consistente, e que os filtros aplicados afectam os tops.
- Garantir Removidos contam (Core rule): nunca filtrar `farmers.status = 'Removido'` neste fluxo.

## Detalhes técnicos
- `parse_ptao_numeric` é `IMMUTABLE`, logo válido em coluna gerada STORED.
- Backfill automático ao criar coluna gerada (Postgres preenche existentes).
- 70 394 linhas actuais → preenchimento sub-segundo; índice btree para suportar `ORDER BY valor_num` e ranges.
- Filtro "produtor" usa `farmer_code` (eq) ou `farmers.full_name ilike`. Como a tabela usa `farmers!fk(...)`, faz-se `.or()` em `farmer_code` + lookup separado por nome via subquery (ou aceitar só `farmer_code`/nº telefone para ser indexável). **Decisão:** input único que tenta `farmer_code = X` ou `full_name ilike %X%` via `or` na join — aproveita índice trgm em `full_name`.
- Cards usam React Query com `queryKey` que inclui todos os filtros + debounce 300ms para evitar requests durante digitação.

## Fora de âmbito
- Exportação CSV (não pedida; existe noutras páginas).
- Gráficos temporais (a página tem perfil de listagem; o módulo Relatórios cobre análise temporal).
- Alterar identidade visual / layout global.