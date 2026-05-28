# Unificação dos módulos Stock e Preços & Stock (Portal Fornecedor)

## Diagnóstico

Os dois itens da sidebar do fornecedor cobrem o mesmo domínio (produtos do fornecedor + `stock_movements`), com funcionalidades parcialmente redundantes:

| Funcionalidade | `/fornecedor/stock` (Gestão de Stock) | `/fornecedor/precos` (Preços & Stock) |
|---|---|---|
| Listar produtos | ✅ Tabela + KPIs + alertas | ✅ Tabela simples |
| Editar preço | ❌ | ✅ (com motivo + `product_price_history`) |
| Ajustar stock | ✅ Entrada/Saída/Ajuste tipados | ✅ Ajuste genérico (com motivo) |
| Editar stock mínimo | ✅ | ❌ |
| Histórico de movimentos | ✅ (`stock_movements`) | ✅ (combinado preço + stock) |
| KPIs, alertas, saúde do stock | ✅ | ❌ |

**Conclusão:** o utilizador tem razão — são essencialmente a mesma coisa. `Preços & Stock` foi adicionado depois para colmatar a ausência de edição de preço em `Stock`, mas acabou por duplicar a lógica de ajuste de stock.

## Proposta: módulo único "Stock & Preços"

Manter a página rica (`FornecedorStock.tsx`) como base e absorver a única funcionalidade exclusiva de `FornecedorPrecosStock.tsx`: **edição de preço com motivo + registo em `product_price_history`**.

### Alterações

1. **`src/pages/fornecedor/FornecedorStock.tsx`**
   - Adicionar coluna **Preço** na tabela de produtos (já existe como subtítulo, passa a coluna editável).
   - Adicionar botão **"Editar preço"** (ícone `Tag`) por linha, que abre um diálogo dedicado: novo preço + motivo obrigatório (≥3 chars), grava em `supplier_products` e cria entrada em `product_price_history`.
   - No separador **Movimentos**, integrar também as linhas de `product_price_history` (badge "Preço" vs "Stock"), reaproveitando o componente `HistoryRow` existente em `FornecedorPrecosStock.tsx`.
   - Atualizar título para **"Stock & Preços"**.

2. **`src/components/fornecedor/FornecedorLayout.tsx`**
   - Remover a entrada `/fornecedor/precos` do `navItems`.
   - Renomear o item `Stock` para **"Stock & Preços"** (ícone mantém-se `Warehouse`).

3. **`src/App.tsx`** (rotas)
   - Manter a rota `/fornecedor/precos` apontada para `FornecedorStock` (redirect implícito) durante 1 versão, para não partir links/bookmarks. Alternativa: remover a rota — confirmar preferência.

4. **`src/pages/fornecedor/FornecedorPrecosStock.tsx`**
   - Eliminar após migração da lógica de preço.

### Não muda
- Esquema da BD (`supplier_products`, `stock_movements`, `product_price_history`) — sem migrações.
- RLS, permissões, edge functions.
- POS, Vendas, Facturas.

## Resultado para o utilizador

Sidebar do fornecedor passa de 10 → 9 itens; um único sítio para gerir produtos, preços, stock e ver histórico unificado.

## Pergunta antes de implementar

A rota `/fornecedor/precos` deve **(a)** redirecionar para `/fornecedor/stock` ou **(b)** ser removida (404)?
