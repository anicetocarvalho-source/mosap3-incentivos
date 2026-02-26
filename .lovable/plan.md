

## Plano: Melhorar layout da página Fornecedores

### 1. KPI cards no topo
Adicionar 4 stat cards antes da listagem:
- Total Fornecedores
- Ativos / Inativos
- Total Produtos (soma de `supplier_products` count)
- Total Terminais POS (soma de `supplier_pos` count)

Buscar contagens via queries adicionais no `useEffect` inicial.

### 2. Vista tabela + cards (toggle)
- Adicionar um toggle (ícone grid/list) ao lado da barra de pesquisa para alternar entre vista cards (actual) e vista tabela
- Vista tabela: colunas Nome, NIF, Telefone, Província, Zonas, Status, Acções

### 3. Filtros avançados
- Filtro por status: Select com "Todos", "Ativo", "Inativo"
- Filtro por província (sede): Select com a lista de províncias
- Filtro por zona de actuação: Select com províncias
- Colocar filtros numa linha horizontal entre KPIs e listagem

### 4. Design mais polido
- Cards: usar `stat-card` CSS class existente para KPIs, melhorar espaçamento e hierarquia tipográfica nos cards de fornecedores
- Ícones de cor nos KPIs (Store, CheckCircle, Package, Monitor)
- Badge de status com cores semânticas (verde ativo, cinza inativo)
- Melhorar a vista de detalhe do fornecedor com um header card mais rico

### Ficheiros alterados
- `src/pages/Mosap3PayFornecedores.tsx` — todas as alterações concentradas neste ficheiro

