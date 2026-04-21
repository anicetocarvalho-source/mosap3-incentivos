

## Problema

No menu **Comercial** do MOSAP3Pay existe a entrada "Notas de Crédito" mas **não existe uma página dedicada a Facturas (Série FT)**. As facturas são geradas implicitamente em cada venda POS (campo `invoice_number` em `pos_sales`) e só podem ser reimpressas a partir do histórico de Vendas. Para conformidade AGT e rastreabilidade, é preciso uma vista canónica de facturas, com a numeração oficial em destaque, filtros, exportação e ligação directa a Notas de Crédito.

## Solução

Criar uma nova página **Facturas (Série FT)** em `/mosap3pay/facturas`, alimentada pelas vendas existentes (`pos_sales` + `pos_sale_items`), sem alterações de schema — toda a informação fiscal já está persistida.

### 1. Nova página `src/pages/Mosap3PayFacturas.tsx`

Estrutura simétrica à de Notas de Crédito:

- **Cabeçalho**: título "Facturas (Série FT)" + descrição "Documentos fiscais emitidos — conformidade AGT".
- **KPIs (4 cartões)**: Total de Facturas no período, Receita Total (subtotal), IVA Liquidado, Facturas com NC associada.
- **Filtros**: pesquisa (nº factura / código venda / nome ou código produtor), estado de pagamento (pago/pendente/cancelado), ano, fornecedor (admin).
- **Tabela**:
  | Nº Factura | Data | Produtor | Fornecedor | Subtotal | IVA | Total | Estado | NC | Acções |
  - "Nº Factura" mostra `invoice_number` (FT YYYY/NNNNN) com ícone de cadeado se estiver associada a NC (não pode ser cancelada).
  - "NC" mostra badge "NC emitida" com link para a NC respectiva quando existe.
  - Acções: **Ver detalhe**, **Imprimir/PDF** (reutiliza `InvoicePDF`), **Emitir Nota de Crédito** (abre modal pré-preenchido — só quando paga e sem NC activa).
- **Versão mobile** com cards `divide-y` (padrão do sistema).
- **Exportação CSV** das facturas filtradas.
- **Paginação** 15 por página (padrão `Mosap3PayVendas`).

### 2. Carregamento de dados

Reutilizar o padrão de `Mosap3PayVendas`:
- Query `pos_sales` filtrando apenas registos com `invoice_number IS NOT NULL` e `payment_status != 'cancelado'`.
- Query lateral a `credit_notes` para detectar quais facturas têm NC activa (match por `original_sale_id`).
- Cliques em "Imprimir" usam `generateFiscalHash` + `buildQRContent` (já existentes em `InvoicePDF.tsx`).

### 3. Navegação `src/components/AppNavbar.tsx`

Adicionar a entrada **antes** de "Notas de Crédito" no submenu MOSAP3Pay:

```text
Dashboard
Fornecedores
Terminal POS
Vendas
Facturas          ← novo
Notas de Crédito
Stock
Relatórios
Auditoria
Configurações
```

Ícone: `Receipt` (lucide). `AppSidebar.tsx` herda automaticamente porque lê `navItems`.

### 4. Routing `src/App.tsx`

```tsx
import Mosap3PayFacturas from "@/pages/Mosap3PayFacturas";
<Route path="/mosap3pay/facturas" element={<Mosap3PayFacturas />} />
```

### 5. Breadcrumb `src/components/AppTopbar.tsx`

Adicionar mapeamento `facturas: "Facturas"`.

### 6. Diferenças versus página "Vendas" existente

| Aspecto | Vendas (`/vendas`) | Facturas (`/facturas`) |
|---|---|---|
| Foco | Transação comercial | Documento fiscal AGT |
| Identificador principal | `sale_code` | `invoice_number` (Série FT) |
| Filtra canceladas | não | sim (excluídas por padrão) |
| Inclui sem `invoice_number` | sim | não |
| Acção "Emitir NC" | não | sim |
| Coluna "NC associada" | não | sim |
| Hash fiscal visível | não | sim (no detalhe) |

### Sem alterações
- BD, RLS, edge functions, schema das tabelas (`pos_sales` já tem `invoice_number`, `credit_notes` já tem `original_sale_id`).
- Página de Vendas mantém-se como vista operacional; Facturas é a vista fiscal.

### Ficheiros a editar/criar
- **Criar**: `src/pages/Mosap3PayFacturas.tsx`
- **Editar**: `src/App.tsx`, `src/components/AppNavbar.tsx`, `src/components/AppTopbar.tsx`

### Resultado
O menu Comercial passa a ter "Facturas" antes de "Notas de Crédito", oferecendo uma vista fiscal completa de todos os documentos da Série FT emitidos pelo MOSAP3Pay, com rastreabilidade ponta a ponta (Venda → Factura → NC) e conformidade AGT.

