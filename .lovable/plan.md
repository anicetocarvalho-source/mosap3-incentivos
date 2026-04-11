

## Plano: Vincular itens PATEC aos produtos do fornecedor no POS

### Problema actual
- Os `patec_items` (composição do pacote) e os `supplier_products` (catálogo do fornecedor) são geridos de forma independente.
- No POS, os itens do pacote aparecem como checklist estática, sem indicar quais já têm produto correspondente no catálogo do fornecedor.
- Não existe forma de gerar automaticamente os produtos a partir do template PATEC.

### Alterações previstas

#### 1. Botão "Importar itens PATEC" nos formulários de produtos
**Ficheiros**: `src/pages/Mosap3PayFornecedores.tsx`, `src/pages/fornecedor/FornecedorProdutos.tsx`

- Adicionar botão "Importar do PATEC" junto ao "Adicionar Produto".
- Ao clicar, abre diálogo com selector de PATEC (1, 2 ou 3).
- Carrega `patec_items` desse PATEC e mostra lista com checkbox.
- Itens que já existam no catálogo (match por nome + patec_number) aparecem marcados e desactivados.
- Ao confirmar, insere os itens seleccionados como `supplier_products` com:
  - `name` = nome do patec_item
  - `patec_number` = número do PATEC
  - `patec_category` = categoria do patec_item
  - `category` = mapeamento (Insumos→insumos, Pecuária→pecuaria, Serviços→servicos)
  - `price` = 0 (a preencher pelo fornecedor)
  - `stock` = 0
- Toast de sucesso com contagem de itens importados.

#### 2. Checklist enriquecida no POS
**Ficheiro**: `src/pages/Mosap3PayPOS.tsx`

- Quando o produtor é identificado e os `patec_items` são carregados, cruzar com os `products` do fornecedor seleccionado.
- Para cada item do pacote, mostrar:
  - ✅ verde se existe produto correspondente no catálogo (match por `patec_number` + `patec_category` + nome similar)
  - ⚠️ amarelo/cinza se não existe produto correspondente
- Isto dá visibilidade imediata ao operador sobre quais itens do pacote estão disponíveis para venda.

#### 3. Campo `patec_category` visível nos formulários
**Ficheiros**: `src/pages/fornecedor/FornecedorProdutos.tsx`, `src/pages/Mosap3PayFornecedores.tsx`

- Quando um produto tem `patec_number` definido, mostrar selector de `patec_category` (Insumos, Pecuária, Serviços) para permitir o mapeamento manual.
- Este campo já existe na tabela `supplier_products` mas não está exposto nos formulários do portal do fornecedor.

### Fluxo resultante
1. Admin define composição do pacote em `/patec` (ex: PATEC 1 → Sementes de milho, Enxada, Vacinação)
2. Fornecedor ou admin clica "Importar do PATEC 1" → produtos são criados automaticamente no catálogo
3. Fornecedor define preços e stock para cada produto importado
4. No POS, ao identificar produtor com PATEC 1, a checklist mostra quais itens do pacote o fornecedor tem disponíveis

### Detalhes técnicos
- Nenhuma migração necessária — `patec_category` já existe em `supplier_products`
- Match entre patec_items e supplier_products: `patec_number` + `name` (case-insensitive)
- A importação não duplica itens já existentes

