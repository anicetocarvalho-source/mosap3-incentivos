
## Objectivo

Adicionar 4 cartões KPI na vista de detalhe de cada fornecedor em `/mosap3pay/fornecedores`, alimentados pela tabela `farmer_transactions` (que contém dados reais), fazendo match pelo nome do fornecedor (`suppliers.name` = `farmer_transactions.empresa`).

## Porquê `farmer_transactions` e não `pos_sales`

A tabela `pos_sales` está vazia (0 registos). Os dados de compras dos agricultores estão em `farmer_transactions`, onde a coluna `empresa` contém o nome do fornecedor. Os nomes coincidem com `suppliers.name`.

## KPIs a apresentar

1. **Total Vendido** — soma de `valor` (parseado com `parseAmount`) filtrado por `empresa = supplier.name`
2. **Nº de Transações** — contagem de registos
3. **Ticket Médio** — Total Vendido ÷ Nº de Transações
4. **Última Transação** — data da transação mais recente

## Alterações técnicas

### `src/pages/Mosap3PayFornecedores.tsx`

- Adicionar um `useQuery` que, quando um fornecedor está seleccionado, busca todas as `farmer_transactions` onde `empresa = selectedSupplier.name`
- Calcular os 4 KPIs no `queryFn` usando `parseAmount` para converter os valores
- Renderizar uma grelha de 4 `StatCard` entre o cabeçalho do fornecedor e os tabs existentes
- Usar `formatKz` para valores monetários
- Mostrar `Skeleton` enquanto carrega

Nenhuma alteração de base de dados necessária — os dados já existem.
