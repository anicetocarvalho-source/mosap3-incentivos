

## Objectivo

Disponibilizar uma página de **Facturas (Série FT)** no portal do Fornecedor (`/fornecedor/facturas`), espelhando o que existe no backoffice MOSAP3Pay mas filtrada apenas às vendas do próprio fornecedor, e adicionar um painel de **IVA / Imposto a liquidar** para apoiar a contabilidade.

## Âmbito

### 1. Nova página `src/pages/fornecedor/FornecedorFacturas.tsx`
Reutiliza a lógica de `Mosap3PayFacturas.tsx` mas adaptada ao portal do fornecedor:

- **Fonte de dados**: `pos_sales` filtrado por `supplier_id = supplier.id` (obtido via `useOutletContext`) e com `invoice_number IS NOT NULL`. Não permite filtro por fornecedor (não aplicável).
- **Notas de Crédito**: `credit_notes` filtradas pelo mesmo `supplier_id`, mapeadas por `original_sale_id`.
- **KPIs no topo (4 cards)**:
  1. Total de Facturas emitidas
  2. Receita Total (soma de `total`)
  3. **IVA a Liquidar** (soma de `iva_total` das facturas pagas, descontando IVA de NC activas) — destaque visual (`accent`/`warning`)
  4. Notas de Crédito emitidas
- **Painel "Resumo Fiscal" (novo)**: card dedicado com:
  - Subtotal (sem IVA)
  - IVA Total Liquidado (taxa 14%)
  - Total Facturado (com IVA)
  - IVA das NC (a deduzir)
  - **IVA Líquido a Pagar à AGT** (resultado final)
  - Filtrável por ano e trimestre fiscal (Q1–Q4)
- **Tabela de facturas** com colunas: Nº Factura, Data, Produtor, Subtotal, IVA, Total, Estado, NC associada, Acções (ver/PDF).
- **Filtros**: pesquisa (Nº factura, código venda, produtor), ano, trimestre, estado (pago/pendente/cancelado).
- **Ordenação dinâmica**: Nº Factura, Data, Produtor, Total, IVA.
- **Paginação**: 15 por página.
- **Exportação CSV** com coluna de IVA incluída (apoio contabilístico).
- **Modal de impressão**: reutiliza `InvoicePDF` com `generateFiscalHash` + `buildQRContent`.

### 2. Navegação no portal Fornecedor
Editar `src/components/fornecedor/FornecedorLayout.tsx`:
- Adicionar item "Facturas" no `navItems` (ícone `Receipt` do lucide), posicionado **entre** "Vendas" e "Lojas".

### 3. Routing
Editar `src/App.tsx`:
- Adicionar `<Route path="facturas" element={<FornecedorFacturas />} />` dentro do bloco `<Route path="/fornecedor" element={<FornecedorLayout />}>`.

## Detalhes técnicos

- **Cálculo do IVA Líquido**:
  ```
  IVA_liquido = Σ(iva_total das facturas com payment_status='pago')
              − Σ(iva_total das NC com status='emitida')
  ```
- **RLS já cobre o caso**: `pos_sales` tem policy `Suppliers can view own sales` e `credit_notes` tem `Auth users can view credit notes`. Não são necessárias alterações de schema/RLS/edge functions.
- **Reaproveitamento**: importar `InvoicePDF`, `generateFiscalHash`, `buildQRContent` de `@/components/InvoicePDF`; importar `LoadingState`, `ErrorState`, `EmptyState`.
- **Conformidade AGT**: o painel fiscal segue a estrutura do que já existe em `Mosap3PayRelatorios` (secção AGT) mas restrita ao fornecedor.

## Ficheiros

- **Criar**: `src/pages/fornecedor/FornecedorFacturas.tsx`
- **Editar**: `src/App.tsx`, `src/components/fornecedor/FornecedorLayout.tsx`

## Resultado

O fornecedor passa a ter uma vista fiscal completa das facturas emitidas pelas suas vendas, com cálculo automático do IVA a liquidar à AGT (líquido de notas de crédito), exportação CSV para contabilidade, e impressão/PDF de cada documento — totalmente isolado dos dados de outros fornecedores.

