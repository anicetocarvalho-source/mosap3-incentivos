
## Objectivo

Adicionar cartões de KPI financeiros na vista de detalhe de cada fornecedor na página de Fornecedores (`/mosap3pay/fornecedores`), entre o cabeçalho e os tabs existentes.

## KPIs a apresentar

1. **Total Vendido** — soma de `pos_sales.total` filtrado por `supplier_id`
2. **Nº de Transações** — contagem de `pos_sales` filtrado por `supplier_id`
3. **Ticket Médio** — Total Vendido ÷ Nº de Transações
4. **Última Venda** — data da venda mais recente

## Alterações técnicas

### `src/pages/Mosap3PayFornecedores.tsx`

- Após seleccionar um fornecedor, fazer uma query adicional a `pos_sales` para obter a soma do `total`, contagem de registos e data da última venda (`max(created_at)`)
- Inserir uma grelha de 4 `StatCard` (componente já existente) entre o cabeçalho do fornecedor e os `Tabs`, mostrando os 4 KPIs
- Usar `formatKz` para valores monetários
- Mostrar skeleton enquanto carrega

Nenhuma alteração de base de dados é necessária — os dados já existem na tabela `pos_sales`.
